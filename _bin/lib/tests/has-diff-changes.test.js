// Tests for the changed-files predicate the build, publish and deploy steps are gated on.
//
// The bug these were written for: on the stage merge at a5ce2eee the build step died
// with "git diff --name-only HEAD^1 -- therr-client-web failed", because CircleCI had
// handed the job a shallow clone in which HEAD has no parent. The guard that produced
// that message is correct — a git failure must never read as "no changes" — but the
// pipeline should not be stopped by a missing commit that is one fetch away.
//
// So the cases below are all about the two ways this can go wrong, in real throwaway
// repositories rather than against stubbed output: reporting "unchanged" when git
// could not answer (a silent skip), and refusing to build when the answer was
// obtainable (a stuck deploy).

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const bash = (snippet, opts = {}) => execFileSync('bash', ['-c', snippet], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    ...opts,
}).trim();

// Runs a snippet inside <dir> with the library sourced the way the CI scripts source
// it — relative to the repo root the script is run from. `set -e` matches the shebang
// preamble every caller has, so a helper that aborts aborts here too.
const inRepo = (dir, snippet, env = {}) => bash(
    `set -e; source ./_bin/lib/has_diff_changes.sh; ${snippet}`,
    { cwd: dir, env: { ...process.env, ...env } },
);

const installLibs = (dir) => {
    fs.mkdirSync(path.join(dir, '_bin', 'lib'), { recursive: true });
    for (const lib of ['colorize.sh', 'has_diff_changes.sh']) {
        fs.copyFileSync(path.join(REPO_ROOT, '_bin', 'lib', lib), path.join(dir, '_bin', 'lib', lib));
    }
    fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), '_bin/\n');
};

// An origin repo whose `stage` branch holds two commits: the second one touches
// therr-client-web only, which is exactly the shape of the merge that failed.
const withOrigin = (fn) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'has-diff-'));
    const origin = path.join(root, 'origin');
    fs.mkdirSync(origin);

    const git = (args, cwd = origin) => bash(`git ${args}`, { cwd });

    git('init -q -b stage');
    git('config user.email test@example.com');
    git('config user.name Test');

    const commit = (file, message) => {
        fs.mkdirSync(path.dirname(path.join(origin, file)), { recursive: true });
        fs.appendFileSync(path.join(origin, file), `${message}\n`);
        git('add -A');
        git(`commit -q -m '${message}'`);
        return git('rev-parse HEAD');
    };

    commit('therr-services/users-service/index.ts', 'base');
    commit('therr-client-web/src/index.tsx', 'landing page update');

    try {
        return fn({ root, origin, git });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
};

const STAGE = { CICD_BRANCH: 'stage', CIRCLE_BRANCH: 'stage' };

// --- A full checkout: the ordinary path, unchanged -----------------------------------------

withOrigin(({ root, origin }) => {
    const clone = path.join(root, 'full');
    bash(`git clone -q "${origin}" "${clone}"`);
    installLibs(clone);

    assert.strictEqual(
        inRepo(clone, 'has_prev_diff_changes therr-client-web >/dev/null && echo changed', STAGE),
        'changed',
        'The path the last commit touched must read as changed.',
    );

    assert.strictEqual(
        inRepo(clone, 'has_prev_diff_changes therr-services/users-service >/dev/null || echo unchanged', STAGE),
        'unchanged',
        'A path the merge did not touch must still read as unchanged — this is the whole point of the predicate.',
    );
});

// --- A shallow checkout: what actually broke the deploy -------------------------------------

withOrigin(({ root, origin }) => {
    const clone = path.join(root, 'shallow');
    // file:// rather than a plain path: git only honours --depth over a real transport.
    bash(`git clone -q --depth 1 "file://${origin}" "${clone}"`);
    installLibs(clone);

    assert.strictEqual(
        bash('git rev-parse --is-shallow-repository', { cwd: clone }),
        'true',
        'Fixture must actually be shallow, or this case proves nothing.',
    );

    // Before the fix this exited 1 and took the build job with it.
    assert.strictEqual(
        inRepo(clone, 'has_prev_diff_changes therr-client-web >/dev/null && echo changed', STAGE),
        'changed',
    );

    // Deepening has to give the real answer, not a blanket "everything changed":
    // fail-open on every service would rebuild and republish all eight.
    assert.strictEqual(
        inRepo(clone, 'has_prev_diff_changes therr-services/users-service >/dev/null || echo unchanged', STAGE),
        'unchanged',
        'Once deepened, an untouched service must go back to reading as unchanged.',
    );

    // One attempt, recorded in the git dir rather than in a shell variable, so the
    // eight services build.sh iterates do not each pay for their own fetch.
    assert.ok(
        fs.existsSync(path.join(clone, '.git', 'therr-deepen-attempted')),
        'The deepen attempt must be recorded where a later subshell can see it.',
    );
});

// --- A shallow checkout that cannot be deepened ---------------------------------------------

withOrigin(({ root, origin }) => {
    const clone = path.join(root, 'stranded');
    bash(`git clone -q --depth 1 "file://${origin}" "${clone}"`);
    installLibs(clone);
    bash(`git remote set-url origin "file://${root}/gone"`, { cwd: clone });

    // Unreachable parent, unreachable remote: the honest answer is "cannot tell", and
    // the only safe way to spend it is to build. Reporting "unchanged" here is the
    // silent skip that published an image nothing had built.
    assert.strictEqual(
        inRepo(clone, 'has_prev_diff_changes therr-client-web >/dev/null && echo changed', STAGE),
        'changed',
        'An unanswerable diff must fail open, never skip.',
    );

    assert.strictEqual(
        inRepo(clone, 'has_prev_diff_changes therr-services/users-service >/dev/null && echo changed', STAGE),
        'changed',
        'Fail-open applies to every path, not just the one that happens to have changed.',
    );
});

// --- prev_tip's contract --------------------------------------------------------------------

withOrigin(({ root, origin }) => {
    const clone = path.join(root, 'contract');
    bash(`git clone -q "${origin}" "${clone}"`);
    installLibs(clone);

    // Only the SHA reaches stdout — callers assign it with `BASE=$(prev_tip)`, so a
    // stray warning on stdout would become part of the revision they diff against.
    const tip = inRepo(clone, 'prev_tip', STAGE);
    assert.match(tip, /^[0-9a-f]{40}$/, `prev_tip must echo a bare SHA, got: ${JSON.stringify(tip)}`);
    assert.strictEqual(tip, bash('git rev-parse HEAD^1', { cwd: clone }));
});

console.log('has-diff-changes: all assertions passed');
