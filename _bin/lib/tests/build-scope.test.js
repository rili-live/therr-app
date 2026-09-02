// Tests for what the stage build considers "changed".
//
// The incident: the stage run at a5ce2eee aborted in build.sh before publishing
// anything, so the merge carrying the habits landing-page change stayed behind
// HEAD^1 from then on. Under the old predicate — "what did this merge bring in" —
// the next merge to stage would have reported client-web unchanged, skipped it, and
// left production on the previous image, with every log line reading green.
//
// service_needs_build asks instead "has this service changed since the image we last
// published for it", using the SHA VERSIONS.txt already records per service. The
// cases below pin both halves of that: it must pick up the stranded service, and it
// must still skip services that genuinely have not moved — a predicate that always
// says yes would rebuild and republish all eight on every merge.

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const LIBS = ['colorize.sh', 'has_diff_changes.sh', 'service-registry.sh', 'versions-ledger.sh', 'build-scope.sh'];

const bash = (snippet, opts = {}) => execFileSync('bash', ['-c', snippet], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    ...opts,
}).trim();

// The scripts source their libs as ./_bin/lib/... relative to the repo root they run
// from, so the fixture gets its own copy rather than the convention being relaxed.
const inRepo = (dir, snippet) => bash(
    `set -e; ${LIBS.map((l) => `source ./_bin/lib/${l}`).join('; ')}; ${snippet}`,
    { cwd: dir, env: { ...process.env, CICD_BRANCH: 'stage', CIRCLE_BRANCH: 'stage' } },
);

// A repo shaped like stage after the failed run: the client-web change is real and
// unpublished, and it is no longer in the last merge's range.
const withRepo = (fn) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-scope-'));
    const git = (args) => bash(`git ${args}`, { cwd: dir });

    git('init -q -b stage');
    git('config user.email test@example.com');
    git('config user.name Test');

    fs.mkdirSync(path.join(dir, '_bin', 'lib'), { recursive: true });
    for (const lib of LIBS) {
        fs.copyFileSync(path.join(REPO_ROOT, '_bin', 'lib', lib), path.join(dir, '_bin', 'lib', lib));
    }
    fs.writeFileSync(path.join(dir, '.git', 'info', 'exclude'), '_bin/\nVERSIONS.txt\n');

    const commit = (file, message) => {
        fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        fs.appendFileSync(path.join(dir, file), `${message}\n`);
        git('add -A');
        git(`commit -q -m '${message}'`);
        return git('rev-parse HEAD');
    };

    const published = commit('therr-services/users-service/index.ts', 'base');
    commit('therr-client-web/src/index.tsx', 'habits landing page');
    commit('docs/WORK_IN_PROGRESS.md', 'the next merge, which touches neither service');

    const ledger = (rows) => fs.writeFileSync(path.join(dir, 'VERSIONS.txt'), `${rows.join('\n')}\n`);

    try {
        return fn({
            dir, git, ledger, published, inDir: (snippet) => inRepo(dir, snippet),
        });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

const verdict = (inDir, key) => inDir(
    `ledger_load VERSIONS.txt; if service_needs_build ${key} >/dev/null; then echo build; else echo skip; fi`,
);

// --- The stranded service ---------------------------------------------------------------------

withRepo(({ ledger, published, inDir }) => {
    ledger([
        `LAST_PUBLISHED_GIT_SHA=${published}`,
        `PUBLISHED_CLIENT_WEB=${published}`,
        `PUBLISHED_USERS_SERVICE=${published}`,
    ]);

    // First, the trap, so this test fails if someone reverts to the merge range: the
    // change is real, unpublished, and invisible to HEAD^1.
    assert.strictEqual(
        inDir('if has_prev_diff_changes_any therr-client-web >/dev/null; then echo build; else echo skip; fi'),
        'skip',
        'Fixture must reproduce the stranding: the HEAD^1 range does not see the change.',
    );

    assert.strictEqual(
        verdict(inDir, 'client-web'),
        'build',
        'A service whose sources moved since its published image must build, whatever the merge range says.',
    );

    assert.strictEqual(
        verdict(inDir, 'users-service'),
        'skip',
        'A service that has not moved since its published image must still be skipped.',
    );
});

// --- Falling back when the ledger cannot answer -------------------------------------------------

withRepo(({ ledger, inDir }) => {
    // No row at all: a service that has never been published.
    ledger(['LAST_PUBLISHED_GIT_SHA=']);
    assert.strictEqual(
        verdict(inDir, 'client-web'),
        'skip',
        'With no row, the verdict falls back to the HEAD^1 range — which here is empty.',
    );

    // A SHA no object in this checkout matches: an old row, or history the clone does
    // not carry. It must fall back rather than treat the missing object as "unchanged".
    ledger(['PUBLISHED_CLIENT_WEB=0123456789012345678901234567890123456789']);
    const out = inDir('ledger_load VERSIONS.txt; service_needs_build client-web || true');
    assert.match(out, /unreachable here — falling back/, out);
});

// --- The library changes that feed an image ------------------------------------------------------

withRepo(({
    dir, git, ledger, published, inDir,
}) => {
    fs.mkdirSync(path.join(dir, 'therr-public-library', 'therr-react'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'therr-public-library', 'therr-react', 'index.ts'), 'export {};\n');
    git('add -A');
    git("commit -q -m 'shared library change'");

    ledger([`PUBLISHED_CLIENT_WEB=${published}`, `PUBLISHED_USERS_SERVICE=${published}`]);

    // therr-react is compiled into the web image but into no backend image, so the
    // registry's per-service source fan-out has to be what decides this.
    assert.strictEqual(verdict(inDir, 'client-web'), 'build');
    assert.strictEqual(verdict(inDir, 'users-service'), 'skip');
});

console.log('build-scope: all assertions passed');
