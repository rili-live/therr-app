// Tests for the verify pass applying migrations that serving code is missing.
//
// From 2026-10-08 to 10-12 users-service served the 10-08 build without its two
// migrations. Its rollout had missed the deploy's progress deadline, so the deploy put it
// out of scope ("did not reach its intended version — not migrating underneath it"), and
// the verify pass then printed "users-service is running code with 2 unapplied
// migration(s)" on three runs in a row and only reported it. No new Friends with Habits
// user could start a habit for those four days.
//
// The count comes from the pod's own code, so a positive count from a Ready pod means the
// code that needs the migrations is already taking traffic. The deploy step now applies
// them there. What must not change: a pod that is not Ready is only reported, and
// --verify-only applies nothing.

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, '_bin', 'cicd', 'run-migrations.sh');

// A stateful fake kubectl. Reports 2 pending migrations until `migrations:run` has been
// executed (when RUN_EXIT is 0), and records every `migrations:run` in $STATE/runs.
const FAKE_KUBECTL = `#!/bin/bash
case "$*" in
  "get pods -l "*) echo "users-pod" ;;
  "get pod users-pod "*) echo "$FAKE_READY" ;;
  *"migrations:status"*)
    if [ -f "$STATE/migrated" ]; then echo "No Pending Migration files Found."; else echo "Found 2 Pending Migration files."; fi ;;
  *"migrations:run"*)
    echo run >> "$STATE/runs"
    [ "\${RUN_EXIT:-0}" = "0" ] && touch "$STATE/migrated"
    exit "\${RUN_EXIT:-0}" ;;
  "rollout status "*) exit 0 ;;
  *) echo "unexpected kubectl $*" >&2; exit 1 ;;
esac
`;

const runWith = ({ ready = 'True', runExit = 0 }, snippet) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-migrations-heal-'));
    const state = path.join(dir, 'state');
    fs.mkdirSync(state);
    fs.writeFileSync(path.join(dir, 'kubectl'), FAKE_KUBECTL);
    fs.chmodSync(path.join(dir, 'kubectl'), 0o755);

    try {
        const output = execFileSync('bash', ['-c', `
            source "${SCRIPT}" >/dev/null 2>&1
            THERR_MIGRATABLE_SERVICES="users-service"
            ${snippet}
        `], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env: {
                ...process.env,
                CICD_BRANCH: 'general',
                PATH: `${dir}${path.delimiter}${process.env.PATH}`,
                STATE: state,
                FAKE_READY: ready,
                RUN_EXIT: String(runExit),
            },
        });
        const runsFile = path.join(state, 'runs');
        const runs = fs.existsSync(runsFile) ? fs.readFileSync(runsFile, 'utf8').trim().split('\n').length : 0;
        return { output, runs };
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

const VERIFY = `
    PENDING_SERVICES=(); HEALED_SERVICES=()
    RC=0; verify_no_pending_migrations >/dev/null 2>&1 || RC=$?; echo "RC=$RC"
    echo "PENDING=\${PENDING_SERVICES[*]}"
    echo "HEALED=\${HEALED_SERVICES[*]}"
`;

{
    // The outage case: the deploy step finds a Ready pod serving code ahead of its schema.
    const { output, runs } = runWith({ ready: 'True' }, `HEAL_PENDING=true\n${VERIFY}`);
    assert.strictEqual(runs, 1, 'migrations:run must be executed once in the serving pod');
    assert.match(output, /HEALED=users-service/);
    assert.match(output, /PENDING=\n/);
    assert.match(output, /RC=0/);
}

{
    // Running but not Ready: possibly a replacement that never came up. Report, never migrate.
    const { output, runs } = runWith({ ready: 'False' }, `HEAL_PENDING=true\n${VERIFY}`);
    assert.strictEqual(runs, 0);
    assert.match(output, /PENDING=users-service \(2\)/);
    assert.match(output, /HEALED=\n/);
}

{
    // Without HEAL_PENDING (any standalone run) the verify pass only reports.
    const { output, runs } = runWith({ ready: 'True' }, VERIFY);
    assert.strictEqual(runs, 0);
    assert.match(output, /PENDING=users-service \(2\)/);
}

{
    // A heal that fails leaves the service reported as behind, so the deploy still fails.
    const { output, runs } = runWith({ ready: 'True', runExit: 1 }, `HEAL_PENDING=true\n${VERIFY}`);
    assert.strictEqual(runs, 1);
    assert.match(output, /PENDING=users-service \(2\)/);
    assert.match(output, /HEALED=\n/);
}

{
    // --verify-only promises to apply nothing, even against a Ready pod that is behind.
    const { output, runs } = runWith({ ready: 'True' }, 'RC=0; main --verify-only || RC=$?; echo "EXIT=$RC"');
    assert.strictEqual(runs, 0);
    assert.match(output, /EXIT=1/);
}

{
    // The 2026-10-10 replay: on main, nothing reached its intended version (an empty scope),
    // yet users-service is Ready and serving code with unapplied migrations. The deploy step
    // must apply them and pass, not skip them and report.
    const { output, runs } = runWith({ ready: 'True' }, `
        CURRENT_BRANCH=main
        MIGRATE_SCOPE_RESTRICTED=true
        MIGRATE_ONLY_SERVICES=""
        RC=0; main || RC=$?; echo "EXIT=$RC"
    `);
    assert.strictEqual(runs, 1);
    assert.match(output, /Applied migrations that serving code was missing: users-service/);
    assert.match(output, /EXIT=0/);
}

console.log('run-migrations-heal: all assertions passed');
