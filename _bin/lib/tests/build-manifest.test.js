// Tests for the two halves of "publish must not push what build did not build".
//
// The incident these were written for: on the stage merge at e4790de8, build.sh
// skipped all eight services as "No Changes" and went green, while publish.sh —
// the same predicate, the same checkout, four steps later in the same job — found
// therr-client-web changed and pushed a tag nothing had built. The job died at
// `docker push` with "An image does not exist locally", a message about the
// registry for a fault in the build step.
//
// Two things had to be true for that to happen, and each gets a test here:
//
//   1. A git failure inside the changed-files predicate read as "nothing changed".
//      `NUM=$(git diff ... | wc -l)` reports wc's status, so git dying produced
//      zero lines and `[[ 0 -gt 0 ]]` was false. Silent skip.
//   2. build and publish each evaluated that predicate independently, so there was
//      nothing to notice they had disagreed.
//
// The rule the first group asserts is "an unanswerable diff must never read as no
// changes" — not "must abort". Where the answer is merely absent rather than broken
// (HEAD^1 missing in a shallow checkout, which is what stopped the stage merge at
// a5ce2eee) the predicate deepens and, failing that, reports *changed*: building more
// than necessary costs a job, skipping costs a deploy.

const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

// Runs a snippet with the libraries sourced from the repo root (they source each
// other by relative path), optionally after cd-ing elsewhere.
const run = (snippet, { env = {} } = {}) => spawnSync('bash', ['-c', snippet], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
});

// A throwaway repo with `count` commits, each touching src/ and docs/.
const makeRepo = (count) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'therr-diff-'));
    const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });

    git('init', '--quiet', '-b', 'stage');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    fs.mkdirSync(path.join(dir, 'src'));
    fs.mkdirSync(path.join(dir, 'docs'));

    for (let i = 0; i < count; i += 1) {
        fs.writeFileSync(path.join(dir, 'src', 'index.js'), `// rev ${i}\n`);
        if (i === 0) {
            fs.writeFileSync(path.join(dir, 'docs', 'notes.md'), '# notes\n');
        }
        git('add', '-A');
        git('commit', '--quiet', '-m', `commit ${i}`);
    }

    return dir;
};

// --- 1. A git failure must stop the script, not read as "no changes" ---------------------------

{
    // A rev git cannot resolve at all, with the path perfectly ordinary: the guard
    // has to read git's exit status rather than its line count, and stop the script.
    const repo = makeRepo(2);
    const result = run(`
        source ./_bin/lib/has_diff_changes.sh
        cd "${repo}"
        _count_diff_files no-such-rev -- src
        echo REACHED_END
    `, { env: { CICD_BRANCH: 'stage' } });

    assert.notStrictEqual(
        result.status,
        0,
        'A git diff that fails must fail the script, not fall through',
    );
    assert.ok(
        !result.stdout.includes('REACHED_END'),
        'The script must abort at the failure, not continue past it',
    );
    assert.ok(
        /Refusing to report 'no changes'/.test(result.stdout),
        `The abort must say why, so the build log names the real fault; got:\n${result.stdout}`,
    );

    fs.rmSync(repo, { recursive: true, force: true });
}

{
    // One commit, so HEAD^1 does not resolve — the shape a shallow checkout presents,
    // and what stopped the stage merge at a5ce2eee. With no remote to deepen from the
    // answer is unobtainable, and the only safe verdict is "changed".
    const repo = makeRepo(1);
    const result = run(`
        source ./_bin/lib/has_diff_changes.sh
        cd "${repo}"
        if has_prev_diff_changes src; then echo "VERDICT changed"; else echo "VERDICT no-changes"; fi
        echo REACHED_END
    `, { env: { CICD_BRANCH: 'stage' } });

    assert.strictEqual(
        result.status,
        0,
        `A missing HEAD^1 must not stop the pipeline; got:\n${result.stdout}\n${result.stderr}`,
    );
    assert.ok(
        result.stdout.includes('VERDICT changed'),
        `An unresolvable base must fail open, never skip; got:\n${result.stdout}`,
    );
    assert.ok(
        /no resolvable first parent/.test(result.stdout),
        `The fail-open must say why, so an operator can tell it from a real diff; got:\n${result.stdout}`,
    );

    fs.rmSync(repo, { recursive: true, force: true });
}

{
    // The guard must not have broken the ordinary path: with HEAD^1 resolvable, a
    // touched path is still "changed" and an untouched one still is not.
    const repo = makeRepo(2);
    const result = run(`
        source ./_bin/lib/has_diff_changes.sh
        cd "${repo}"
        if has_prev_diff_changes src; then echo "SRC changed"; else echo "SRC no-changes"; fi
        if has_prev_diff_changes docs; then echo "DOCS changed"; else echo "DOCS no-changes"; fi
    `, { env: { CICD_BRANCH: 'stage' } });

    assert.strictEqual(result.status, 0, `Expected a clean run, got:\n${result.stderr}`);
    assert.ok(result.stdout.includes('SRC changed'), result.stdout);
    assert.ok(result.stdout.includes('DOCS no-changes'), result.stdout);

    fs.rmSync(repo, { recursive: true, force: true });
}

{
    // has_prev_diff_changes_any is what build.sh and publish.sh actually call, and it
    // must inherit both behaviours rather than flattening them while looping paths:
    // it aborts on a broken diff, and reports changed on an unobtainable base.
    const repo = makeRepo(2);
    const broken = run(`
        source ./_bin/lib/has_diff_changes.sh
        cd "${repo}"
        _count_diff_files no-such-rev -- src
        if has_prev_diff_changes_any src docs; then echo "VERDICT changed"; else echo "VERDICT no-changes"; fi
    `, { env: { CICD_BRANCH: 'stage' } });

    assert.notStrictEqual(broken.status, 0, 'The multi-path form must abort too');
    assert.ok(!broken.stdout.includes('VERDICT'), broken.stdout);

    const shallow = makeRepo(1);
    const result = run(`
        source ./_bin/lib/has_diff_changes.sh
        cd "${shallow}"
        if has_prev_diff_changes_any src docs; then echo "VERDICT changed"; else echo "VERDICT no-changes"; fi
    `, { env: { CICD_BRANCH: 'stage' } });

    assert.strictEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok(result.stdout.includes('VERDICT changed'), result.stdout);

    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(shallow, { recursive: true, force: true });
}

// --- 2. The manifest: what build.sh built, read back by publish.sh -----------------------------

{
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'therr-manifest-'));
    const manifest = path.join(dir, 'manifest.tsv');

    const result = run(`
        source ./_bin/lib/colorize.sh
        source ./_bin/lib/build-manifest.sh
        BUILD_MANIFEST_FILE="${manifest}"

        if manifest_exists; then echo "PRE exists"; else echo "PRE absent"; fi

        manifest_reset
        if manifest_exists; then echo "EMPTY exists"; else echo "EMPTY absent"; fi
        if manifest_has client-web; then echo "EMPTY has-client-web"; else echo "EMPTY no-client-web"; fi

        manifest_add client-web therrapp/client-web-stage:latest therrapp/client-web-stage:abc123
        manifest_add users-service therrapp/users-service-stage:latest therrapp/users-service-stage:abc123

        if manifest_has client-web; then echo "AFTER has-client-web"; else echo "AFTER no-client-web"; fi
        if manifest_has maps-service; then echo "AFTER has-maps"; else echo "AFTER no-maps"; fi
        echo "LATEST $(manifest_tag_latest client-web)"
        echo "SHA $(manifest_tag_sha client-web)"
    `);

    assert.strictEqual(result.status, 0, `Expected a clean run, got:\n${result.stderr}`);

    // "Never ran" and "ran, built nothing" must be distinguishable — publish.sh
    // treats the first as a hard error and the second as a legitimate no-op.
    assert.ok(result.stdout.includes('PRE absent'), result.stdout);
    assert.ok(result.stdout.includes('EMPTY exists'), result.stdout);
    assert.ok(result.stdout.includes('EMPTY no-client-web'), result.stdout);

    assert.ok(result.stdout.includes('AFTER has-client-web'), result.stdout);
    assert.ok(result.stdout.includes('AFTER no-maps'), result.stdout);
    assert.ok(result.stdout.includes('LATEST therrapp/client-web-stage:latest'), result.stdout);
    assert.ok(result.stdout.includes('SHA therrapp/client-web-stage:abc123'), result.stdout);

    fs.rmSync(dir, { recursive: true, force: true });
}

{
    // A key whose name is a prefix of another must not match it — awk on the whole
    // field rather than a substring. `maps-service` vs a hypothetical
    // `maps-service-v2` is the shape that would silently publish the wrong image.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'therr-manifest-'));
    const manifest = path.join(dir, 'manifest.tsv');

    const result = run(`
        source ./_bin/lib/colorize.sh
        source ./_bin/lib/build-manifest.sh
        BUILD_MANIFEST_FILE="${manifest}"
        manifest_reset
        manifest_add maps-service-v2 therrapp/maps-service-v2-stage:latest therrapp/maps-service-v2-stage:abc123
        if manifest_has maps-service; then echo "MATCHED prefix"; else echo "NO prefix match"; fi
    `);

    assert.strictEqual(result.status, 0, `Expected a clean run, got:\n${result.stderr}`);
    assert.ok(result.stdout.includes('NO prefix match'), result.stdout);

    fs.rmSync(dir, { recursive: true, force: true });
}

// --- 3. The registry keys build.sh writes are the keys publish.sh looks up ----------------------

{
    // Both scripts key the manifest off `service_keys`, so a key that cannot survive
    // a round trip through the file would break the handoff for that service only —
    // the kind of gap that shows up as one service silently never publishing.
    const keys = execFileSync('bash', ['-c', 'source ./_bin/lib/service-registry.sh && service_keys'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    }).trim().split('\n');

    assert.ok(keys.length > 0, 'The registry must expose keys');

    keys.forEach((key) => {
        assert.ok(
            /^[a-z0-9-]+$/.test(key),
            `Manifest keys are read back with awk on a tab-separated field: '${key}' must not contain whitespace`,
        );
    });
}

console.log('build-manifest.test.js: all assertions passed');
