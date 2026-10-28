// Tests for the pass cache behind _bin/apply-to-changed.sh (test:changed, lint:changed,
// the pre-push hook).
//
// The cache is only worth having if a hit is never wrong. A stale pass would let a
// broken package through the pre-push gate, which is worse than the slow re-run the
// cache exists to avoid. So most cases below are about invalidation: every way a
// package's inputs can change — committed, staged, unstaged, untracked, a shared
// library, the command itself — must produce a miss. All run against throwaway repos.

const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const makeRepo = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-cache-'));
    const git = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
    git(['init', '-q', '-b', 'general']);
    git(['config', 'user.email', 'test@example.com']);
    git(['config', 'user.name', 'Test']);
    fs.mkdirSync(path.join(dir, '_bin', 'lib'), { recursive: true });
    for (const lib of ['colorize.sh', 'check-cache.sh']) {
        fs.copyFileSync(path.join(REPO_ROOT, '_bin', 'lib', lib), path.join(dir, '_bin', 'lib', lib));
    }
    fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), '_bin/\n');
    const write = (file, body) => {
        fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        fs.writeFileSync(path.join(dir, file), body);
    };
    write('pkg-a/package.json', '{}');
    write('pkg-a/index.js', 'a1');
    write('pkg-b/package.json', '{}');
    write('therr-public-library/therr-js-utilities/index.js', 'u1');
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'init']);
    return { dir, git, write };
};

const sh = (dir, snippet, env = {}) => spawnSync('bash', ['-c', `set -e; source ./_bin/lib/colorize.sh; source ./_bin/lib/check-cache.sh; ${snippet}`], {
    cwd: dir,
    encoding: 'utf8',
    env: {
        ...process.env, CI: '', THERR_CHECK_CACHE: '', ...env,
    },
});

const key = (dir, cmd = 'npm test', pkg = 'pkg-a') => {
    const r = sh(dir, `check_cache_key '${cmd}' '${pkg}'`);
    assert.strictEqual(r.status, 0, r.stderr);
    return r.stdout.trim();
};

test('the key is stable for identical content', () => {
    const { dir } = makeRepo();
    assert.strictEqual(key(dir), key(dir));
});

test('the key changes for committed, unstaged, staged and untracked changes in the package', () => {
    const { dir, git, write } = makeRepo();
    const seen = new Set([key(dir)]);
    write('pkg-a/index.js', 'a2'); // unstaged
    seen.add(key(dir));
    git(['add', '-A']); // staged, same content as unstaged — still differs from base
    write('pkg-a/new.js', 'x'); // untracked
    seen.add(key(dir));
    write('pkg-a/new.js', 'y'); // untracked content change
    seen.add(key(dir));
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'c2']);
    seen.add(key(dir));
    assert.strictEqual(seen.size, 5, 'every state is a distinct key');
});

test('the key changes when a shared library changes, but not when a sibling package does', () => {
    const { dir, write } = makeRepo();
    const base = key(dir);
    write('pkg-b/index.js', 'b2');
    assert.strictEqual(key(dir), base, 'sibling change is not an input');
    write('therr-public-library/therr-js-utilities/index.js', 'u2');
    assert.notStrictEqual(key(dir), base, 'shared library change is an input');
});

test('the key changes with the command', () => {
    const { dir } = makeRepo();
    assert.notStrictEqual(key(dir, 'npm test'), key(dir, 'npm run lint'));
});

test('a pass is skipped on re-run and replayed after the package changes', () => {
    const { dir, write } = makeRepo();
    const run = () => sh(dir, 'check_cache_run pkg-a \'npm test\'', { PATH: `${path.join(dir, 'bin')}:${process.env.PATH}` });
    // A fake `npm` that counts its invocations.
    write('bin/npm', '#!/bin/sh\necho ran >> "$(git rev-parse --show-toplevel)/runs.txt"\n');
    fs.chmodSync(path.join(dir, 'bin', 'npm'), 0o755);
    fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), 'bin/\nruns.txt\n');
    const runs = () => fs.readFileSync(path.join(dir, 'runs.txt'), 'utf8').trim().split('\n').length;

    assert.strictEqual(run().status, 0);
    assert.strictEqual(runs(), 1);
    const second = run();
    assert.strictEqual(second.status, 0);
    assert.ok(second.stdout.includes('already passed on identical content'));
    assert.strictEqual(runs(), 1, 'second run skipped');
    write('pkg-a/index.js', 'changed');
    assert.strictEqual(run().status, 0);
    assert.strictEqual(runs(), 2, 'change replays the package');
});

test('a failure is not cached, propagates its exit code and writes last-failure.json', () => {
    const { dir, write } = makeRepo();
    write('bin/npm', '#!/bin/sh\necho "1 failing: users.test.ts"\nexit 3\n');
    fs.chmodSync(path.join(dir, 'bin', 'npm'), 0o755);
    fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), 'bin/\n');
    const r = sh(dir, 'check_cache_run pkg-a \'npm test\'', { PATH: `${path.join(dir, 'bin')}:${process.env.PATH}` });
    assert.strictEqual(r.status, 3);
    const record = JSON.parse(fs.readFileSync(path.join(dir, '.git', 'therr-check-cache', 'last-failure.json'), 'utf8'));
    assert.strictEqual(record.package, 'pkg-a');
    assert.strictEqual(record.exitCode, 3);
    assert.ok(record.tail.includes('1 failing: users.test.ts'));
    assert.strictEqual(fs.readdirSync(path.join(dir, '.git', 'therr-check-cache', 'pass')).length, 0);
});

test('a later pass of the same package clears its failure record', () => {
    const { dir, write } = makeRepo();
    const bin = path.join(dir, 'bin');
    fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), 'bin/\n');
    write('bin/npm', '#!/bin/sh\nexit 1\n');
    fs.chmodSync(path.join(bin, 'npm'), 0o755);
    sh(dir, 'check_cache_run pkg-a \'npm test\'', { PATH: `${bin}:${process.env.PATH}` });
    const record = path.join(dir, '.git', 'therr-check-cache', 'last-failure.json');
    assert.ok(fs.existsSync(record));
    write('bin/npm', '#!/bin/sh\nexit 0\n');
    assert.strictEqual(sh(dir, 'check_cache_run pkg-a \'npm test\'', { PATH: `${bin}:${process.env.PATH}` }).status, 0);
    assert.ok(!fs.existsSync(record));
});

test('CI, THERR_CHECK_CACHE=0 and non-check commands always run', () => {
    const { dir, write } = makeRepo();
    write('bin/npm', '#!/bin/sh\necho ran >> "$(git rev-parse --show-toplevel)/runs.txt"\n');
    fs.chmodSync(path.join(dir, 'bin', 'npm'), 0o755);
    fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), 'bin/\nruns.txt\n');
    const PATH = `${path.join(dir, 'bin')}:${process.env.PATH}`;
    const runs = () => fs.readFileSync(path.join(dir, 'runs.txt'), 'utf8').trim().split('\n').length;
    sh(dir, 'check_cache_run pkg-a \'npm test\'', { PATH, CI: 'true' });
    sh(dir, 'check_cache_run pkg-a \'npm test\'', { PATH, CI: 'true' });
    assert.strictEqual(runs(), 2, 'CI never skips');
    sh(dir, 'check_cache_run pkg-a \'npm test\'', { PATH, THERR_CHECK_CACHE: '0' });
    assert.strictEqual(runs(), 3, 'opt-out never skips');
    sh(dir, 'check_cache_run pkg-a \'npm run build\'', { PATH });
    sh(dir, 'check_cache_run pkg-a \'npm run build\'', { PATH });
    assert.strictEqual(runs(), 5, 'builds are never skipped');
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
console.log(`check-cache: ${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
