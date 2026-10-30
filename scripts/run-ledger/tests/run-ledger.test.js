// Tests for the run ledger that lets multi-step skills resume after a crash.
//
// What has to hold: starting a run that is already open resumes it instead of
// wiping it (the whole point), a redone step replaces its old answer rather than
// leaving two, finished runs drop out of `show`, and a branch-name key with slashes
// round-trips.

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    start, step, finish, show,
} = require('../index');

const CLI = path.resolve(__dirname, '..', 'index.js');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'run-ledger-'));

test('start on an open run resumes it with its recorded steps', () => {
    const root = tmp();
    start(root, 'split-branch-prs', 'feat/habit-streaks', { tag: 'HABITS' });
    step(root, 'split-branch-prs', 'feat/habit-streaks', 'classify', { shared: ['a.ts'], niche: ['brandConfig.ts'] });
    const again = start(root, 'split-branch-prs', 'feat/habit-streaks', { tag: 'IGNORED' });
    assert.strictEqual(again.resumed, true);
    assert.strictEqual(again.run.meta.tag, 'HABITS', 'meta is not overwritten on resume');
    assert.deepStrictEqual(again.run.steps.map((s) => s.name), ['classify']);
});

test('re-recording a step replaces it', () => {
    const root = tmp();
    start(root, 's', 'k');
    step(root, 's', 'k', 'shared-pr', { url: 'old' });
    step(root, 's', 'k', 'shared-pr', { url: 'new' });
    const [run] = show(root, 's', 'k');
    assert.strictEqual(run.steps.length, 1);
    assert.strictEqual(run.steps[0].data.url, 'new');
});

test('done and abandoned runs leave the open list, and a new start opens a fresh run', () => {
    const root = tmp();
    start(root, 's', 'a');
    start(root, 's', 'b');
    finish(root, 's', 'a', 'done');
    assert.deepStrictEqual(show(root).map((r) => r.key), ['b']);
    assert.strictEqual(show(root, null, null, true).length, 2);
    const fresh = start(root, 's', 'a');
    assert.strictEqual(fresh.resumed, false);
    assert.strictEqual(fresh.run.steps.length, 0);
});

test('step on a run that was never started is an error', () => {
    assert.throws(() => step(tmp(), 's', 'nope', 'x'), /start it first/);
});

test('the CLI round-trips a slash-bearing key and rejects bad JSON', () => {
    const root = tmp();
    const env = { ...process.env, THERR_RUN_LEDGER_DIR: root };
    const run = (...args) => JSON.parse(execFileSync('node', [CLI, ...args], { env, encoding: 'utf8' }));
    run('start', 'split-branch-prs', 'feat/x', '--meta', '{"base":"general"}');
    run('step', 'split-branch-prs', 'feat/x', 'classify', '--data', '{"n":3}');
    const [shown] = run('show', 'split-branch-prs', 'feat/x');
    assert.strictEqual(shown.key, 'feat/x');
    assert.strictEqual(shown.steps[0].data.n, 3);
    assert.throws(() => execFileSync('node', [CLI, 'step', 's', 'k', 'x', '--data', '{bad'], { env, stdio: 'pipe' }));
});

let failed = 0;
for (const { name, fn } of tests) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
    } catch (e) {
        failed += 1;
        console.log(`  ✗ ${name}\n    ${e.message}`);
    }
}
console.log(`run-ledger: ${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
