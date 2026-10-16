// Tests for how deploy.sh paces the Deployments inside one rollout wave.
//
// Wave order controls version skew; it says nothing about how many Pods boot at once.
// On 2026-10-07, 10-08 and three times on 10-10 the six backend services surged together
// onto main-pool's single e2-small, starved each other's CPU-bound boots past their
// progress deadlines (a different service each run), and one of those runs left
// users-service serving code ahead of its schema for four days. deploy_waves now boots
// at most DEPLOY_MAX_CONCURRENT_ROLLOUTS of a wave at a time.
//
// deploy.sh does its work at the top level, so it cannot be sourced; the two functions
// under test are extracted and run against stubbed kubectl and rollout verification.
// apply_changed_spec, which decides whether an apply started a boot, comes from the real
// deploy-plan.sh.

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEPLOY = fs.readFileSync(path.join(REPO_ROOT, '_bin', 'cicd', 'deploy.sh'), 'utf8');
const PLAN_LIB = path.join(REPO_ROOT, '_bin', 'lib', 'deploy-plan.sh');

const extract = (name) => {
    const match = DEPLOY.match(new RegExp(`^${name}\\(\\)\\n\\{[\\s\\S]*?^\\}`, 'm'));
    assert.ok(match, `deploy.sh must define ${name}()`);
    return match[0];
};

const FUNCTIONS = `${extract('settle_rolling_batch')}\n${extract('deploy_waves')}`;

// Returns { verified: [[...batch], ...], output, code }.
//
// `noop` Deployments print "configured" without their generation moving — what client-side
// apply does when its patch is non-empty but the server has nothing to change.
const runWaves = ({
    max, unchanged = [], noop = [], fail = '',
}) => {
    const state = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-waves-'));
    const script = `
source "${PLAN_LIB}"
printMessageNeutral() { echo "N: $*"; }
printMessageError() { echo "E: $*"; }
printMessageWarning() { echo "W: $*"; }
manifest_for() { echo "$1"; }
deployment_rollout_complete() { return 0; }
deployment_generation() { if [ -f "$STATE/$1" ]; then echo 2; else echo 1; fi; }
kubectl() {
  if [[ " $UNCHANGED " == *" $3 "* ]]; then echo "deployment.apps/$3 unchanged"; return; fi
  [[ " $NOOP " == *" $3 "* ]] || touch "$STATE/$3"
  echo "deployment.apps/$3 configured"
}
wait_for_rollouts() {
  echo "VERIFY: $*"
  local d; for d in "$@"; do [ "$d" = "$FAIL" ] && return 1; done
  return 0
}
wait_for_drain() { :; }
ROLLOUT_WAVES=("redis users messages websocket reactions maps push" "gateway" "client")
ROLLOUT_WAVE_NAMES=("internal" "api edge" "public web")
MAX_CONCURRENT_ROLLOUTS="${max}"
UNCHANGED="${unchanged.join(' ')}"
NOOP="${noop.join(' ')}"
STATE="${state}"
FAIL="${fail}"
${FUNCTIONS}
deploy_waves
echo "EXIT=$?"
`;
    let output;
    try {
        output = execFileSync('bash', ['-c', script], { encoding: 'utf8' });
    } finally {
        fs.rmSync(state, { recursive: true, force: true });
    }
    const verified = output.split('\n')
        .filter((line) => line.startsWith('VERIFY: '))
        .map((line) => line.slice('VERIFY: '.length).split(' '));
    const code = Number((output.match(/EXIT=(\d+)/) || [])[1]);
    return { verified, output, code };
};

{
    // Boots go out two at a time, in wave order, and the wave finishes before the next starts.
    const { verified, code } = runWaves({ max: 2 });
    assert.deepStrictEqual(verified, [
        ['redis', 'users'], ['messages', 'websocket'], ['reactions', 'maps'], ['push'], ['gateway'], ['client'],
    ]);
    assert.strictEqual(code, 0);
}

{
    // An unchanged Deployment boots nothing, so it must not take a slot.
    const { verified } = runWaves({ max: 2, unchanged: ['redis', 'websocket'] });
    assert.deepStrictEqual(verified, [['users', 'messages'], ['reactions', 'maps'], ['push'], ['gateway'], ['client']]);
}

{
    // The 2026-10-13 deploy: websocket printed "configured" at an unchanged generation and
    // took the second slot, so push waited a whole batch behind users for a boot that never
    // happened. A no-op apply must take no slot, exactly like "unchanged".
    const unchanged = ['redis', 'messages', 'reactions', 'maps'];
    const { verified, code } = runWaves({ max: 2, unchanged, noop: ['websocket', 'gateway', 'client'] });
    assert.deepStrictEqual(verified, [['users', 'push']]);
    assert.strictEqual(code, 0);
}

{
    // A failed batch stops the deploy before anything else is applied, and names what was not.
    const { verified, output, code } = runWaves({ max: 2, unchanged: ['redis'], fail: 'messages' });
    assert.deepStrictEqual(verified, [['users', 'messages']]);
    assert.strictEqual(code, 1);
    assert.match(output, /Not deployed \(still on the previous version\): websocket reactions maps push gateway client/);
}

{
    // 0 removes the cap: the whole wave rolls together, as before.
    const { verified } = runWaves({ max: 0 });
    assert.deepStrictEqual(verified[0], ['redis', 'users', 'messages', 'websocket', 'reactions', 'maps', 'push']);
}

{
    // Nothing changed anywhere: every wave is reported skipped and nothing is verified.
    const { verified, output, code } = runWaves({
        max: 2,
        unchanged: ['redis', 'users', 'messages', 'websocket', 'reactions', 'maps', 'push', 'gateway', 'client'],
    });
    assert.deepStrictEqual(verified, []);
    assert.strictEqual((output.match(/Skipping wave/g) || []).length, 3);
    assert.strictEqual(code, 0);
}

{
    // The default must stay a real cap. An unset value falling through to "unlimited" is the
    // behaviour that failed five deploys.
    assert.match(DEPLOY, /MAX_CONCURRENT_ROLLOUTS="\$\{DEPLOY_MAX_CONCURRENT_ROLLOUTS:-2\}"/);
}

console.log('deploy-waves-batching: all assertions passed');
