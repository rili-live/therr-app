// Tests for the deploy's per-service verdict, and for the git-range primitives the
// verdict is fed from.
//
// The failure this replaces was never a crash — it was a green deploy that left a
// service on an old image. So the cases that matter are the ones asserting that a
// wrong or absent version is *refused* rather than deployed, and that a service the
// merge diff does not mention still gets picked up when the cluster is behind.
//
// The scenario block at the end builds real throwaway git repositories, because the
// two bugs that actually shipped both came from git ranges behaving differently
// than the scripts assumed, and that is not something a stubbed input can catch.

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PLAN_LIB = path.join(REPO_ROOT, '_bin', 'lib', 'deploy-plan.sh');

const bash = (snippet, opts = {}) => execFileSync('bash', ['-c', snippet], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    ...opts,
}).trim();

// plan_verdict <desired> <running> <image_exists> <build_stale> <would_roll_back> <changed_in_merge>
const verdict = (args, env = {}) => bash(
    `source "${PLAN_LIB}"; plan_verdict ${args.map((a) => `'${a}'`).join(' ')}`,
    { env: { ...process.env, ...env } },
);

const DESIRED = 'aaaaaaa';
const OTHER = 'bbbbbbb';

// --- The ordinary path -----------------------------------------------------------------------

{
    // Cluster is behind, image is there, build is current: roll it.
    assert.strictEqual(verdict([DESIRED, OTHER, 'true', 'false', 'false', 'true']), 'deploy');

    // Same, but the merge diff does not mention this service. It still deploys — this
    // is the convergence that fixes a service stranded by an earlier aborted run,
    // whose commits have since scrolled out of the HEAD^1 range.
    assert.strictEqual(verdict([DESIRED, OTHER, 'true', 'false', 'false', 'false']), 'deploy');

    // Already there: nothing to do.
    assert.strictEqual(verdict([DESIRED, DESIRED, 'true', 'false', 'false', 'true']), 'up-to-date');
}

// --- What must never silently deploy ----------------------------------------------------------

{
    // The publish job did not run, so the newest image predates the code being
    // promoted. The old script pulled it happily and reported success.
    assert.strictEqual(verdict([DESIRED, OTHER, 'true', 'true', 'false', 'true']), 'stale-build');
    assert.ok(bash(`source "${PLAN_LIB}"; verdict_is_blocking stale-build && echo blocking`), 'stale-build must block');

    // Diagnosed as stale-build even when the tag is also missing: "your build is older
    // than your code" is the actionable half, and the existence probe passing is what
    // made this invisible before.
    assert.strictEqual(verdict([DESIRED, OTHER, 'false', 'true', 'false', 'true']), 'stale-build');
}

{
    // The tag in the ledger was never pushed. This is the `docker pull` that used to
    // abort the run under `set -e`, mid-loop, after some services had already been
    // queued — now it is refused up front, before anything touches the cluster.
    assert.strictEqual(verdict([DESIRED, OTHER, 'false', 'false', 'false', 'true']), 'missing-image');
    assert.ok(bash(`source "${PLAN_LIB}"; verdict_is_blocking missing-image && echo blocking`));
}

{
    // ...but a service already running the desired tag is never pulled, so an absent
    // tag says nothing about this run. missing-image is blocking, so probing before
    // the up-to-date check would let a service with nothing to do abort the whole
    // deploy.
    //
    // This case used to carry a second justification: that unrowed services resolving
    // through LAST_PUBLISHED_GIT_SHA would land here rather than on missing-image. They
    // did not — that only holds while the cluster's running tag equals the watermark,
    // and it never did — so the fallback is gone (see ledger_resolve) and an unrowed
    // service now arrives with an empty desired tag instead. The ordering stays for the
    // reason above, which stands on its own.
    assert.strictEqual(verdict([DESIRED, DESIRED, 'false', 'false', 'false', 'true']), 'up-to-date');
    assert.strictEqual(verdict([DESIRED, DESIRED, 'false', 'false', 'false', 'false']), 'up-to-date');

    // A stale build still outranks it: the image predates the promoted code, so this
    // service is running old code however matched its tag looks.
    assert.strictEqual(verdict([DESIRED, DESIRED, 'false', 'true', 'false', 'true']), 'stale-build');
}

{
    // Changed in this merge but nothing published at all: the promotion would drop
    // this service's work on the floor.
    assert.strictEqual(verdict(['', OTHER, 'false', 'false', 'false', 'true']), 'unpublished');
    assert.ok(bash(`source "${PLAN_LIB}"; verdict_is_blocking unpublished && echo blocking`));
}

// --- What must warn rather than block ---------------------------------------------------------

{
    // No published tag, but this merge did not touch the service either. That is
    // pre-existing drift, not something this promotion introduced — reporting it every
    // run is right; failing every unrelated deploy on it is not.
    assert.strictEqual(verdict(['', OTHER, 'false', 'false', 'false', 'false']), 'unresolved');
    assert.strictEqual(bash(`source "${PLAN_LIB}"; verdict_is_blocking unresolved || echo not-blocking`), 'not-blocking');
    assert.strictEqual(bash(`source "${PLAN_LIB}"; verdict_is_warning unresolved && echo warn`), 'warn');
}

{
    // A re-run of an older pipeline resolves to a tag behind what is running. Skipped,
    // so an accidental re-run cannot quietly downgrade production...
    assert.strictEqual(verdict([DESIRED, OTHER, 'true', 'false', 'true', 'false']), 'behind');
    assert.strictEqual(bash(`source "${PLAN_LIB}"; verdict_is_warning behind && echo warn`), 'warn');

    // ...but a deliberate rollback is still one env var away.
    assert.strictEqual(
        verdict([DESIRED, OTHER, 'true', 'false', 'true', 'false'], { DEPLOY_ALLOW_ROLLBACK: 'true' }),
        'deploy',
    );
}

{
    // The deadlock, end to end: ledger_resolve feeding plan_verdict, on the exact
    // VERSIONS.txt that refused three consecutive promotions.
    //
    // stage had published only users-service, twice in a row, so the file held the
    // watermark plus a single row while the cluster sat on a much older tag. Under the
    // old fallback all seven unrowed services resolved to the watermark, and the
    // watermark's -stage tag had only ever been pushed for users-service — so all seven
    // came out missing-image, which is blocking, and the deploy refused before touching
    // the cluster. Including users-service, whose image was fine.
    const LEDGER_LIB = path.join(REPO_ROOT, '_bin', 'lib', 'versions-ledger.sh');
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-ledger-')), 'VERSIONS.txt');

    fs.writeFileSync(file, [
        'LAST_PUBLISHED_GIT_SHA=83a9a7d3730b1248a42a7d2eced7447b303bfef3',
        'PUBLISHED_USERS_SERVICE=83a9a7d3730b1248a42a7d2eced7447b303bfef3',
        '',
    ].join('\n'));

    // The cluster's tag, unchanged through all of it.
    const running = 'eef996d4d5';

    const planFor = (key, imageExists) => bash(`
        source "${LEDGER_LIB}"
        source "${PLAN_LIB}"
        ledger_load "${file}"
        DESIRED="$(ledger_resolve ${key})"
        plan_verdict "$DESIRED" '${running}' '${imageExists}' 'false' 'false' 'false'
    `);

    // The one service with a row, and a real image behind it, still rolls.
    assert.strictEqual(planFor('users-service', 'true'), 'deploy');

    // The seven without a row are left alone with a warning instead of blocking the
    // promotion. `false` is the honest probe result: that tag does not exist for them.
    const unrowed = [
        'client-web',
        'api-gateway',
        'maps-service',
        'messages-service',
        'reactions-service',
        'push-notifications-service',
        'websocket-service',
    ];

    for (const key of unrowed) {
        const v = planFor(key, 'false');
        assert.strictEqual(v, 'unresolved', `${key} must not block a promotion it is not part of`);
        assert.strictEqual(bash(`source "${PLAN_LIB}"; verdict_is_blocking ${v} || echo not-blocking`), 'not-blocking');
    }

    fs.rmSync(path.dirname(file), { recursive: true, force: true });
}

{
    // ...but an unrowed service that DID change in this merge still blocks. Not being
    // published is only benign when the promotion does not carry the service's work.
    assert.strictEqual(verdict(['', OTHER, 'false', 'false', 'false', 'true']), 'unpublished');
    assert.ok(bash(`source "${PLAN_LIB}"; verdict_is_blocking unpublished && echo blocking`));
}

{
    // Every verdict has an explanation; a bare verdict in the CI log is not actionable.
    for (const v of ['deploy', 'up-to-date', 'behind', 'stale-build', 'missing-image', 'unpublished', 'unresolved']) {
        const explanation = bash(`source "${PLAN_LIB}"; verdict_explanation ${v}`);
        assert.ok(explanation && explanation !== 'unknown verdict', `${v} needs an explanation`);
    }
}

// --- The git ranges, against real repositories -------------------------------------------------

const withRepo = (fn) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-plan-repo-'));
    const git = (args) => bash(`git ${args}`, { cwd: dir });

    git('init -q -b general');
    git('config user.email test@example.com');
    git('config user.name Test');

    // The CI scripts all source their dependencies as `./_bin/lib/...`, i.e. relative
    // to the repo root they are run from. Copying the libs in — rather than relaxing
    // that convention for the tests — keeps the thing under test the same shape it has
    // in CI. Excluded from git so they never land in a commit and skew a range.
    fs.mkdirSync(path.join(dir, '_bin', 'lib'), { recursive: true });
    for (const lib of ['colorize.sh', 'has_diff_changes.sh']) {
        fs.copyFileSync(path.join(REPO_ROOT, '_bin', 'lib', lib), path.join(dir, '_bin', 'lib', lib));
    }
    fs.writeFileSync(path.join(dir, '.git', 'info', 'exclude'), '_bin/\n');

    const commit = (file, message) => {
        fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        fs.appendFileSync(path.join(dir, file), `${message}\n`);
        git('add -A');
        git(`commit -q -m '${message}'`);
        return git('rev-parse HEAD');
    };

    try {
        return fn({ dir, git, commit });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

// Runs a snippet with the range helpers sourced, inside a throwaway repo.
const inRepo = (dir, snippet, env = {}) => bash(
    `source ./_bin/lib/has_diff_changes.sh\n${snippet}`,
    { cwd: dir, env: { ...process.env, ...env } },
);

{
    // sources_changed_between is the check that catches an image built before the code
    // it is supposed to contain — the one thing nothing in the old pipeline looked for.
    withRepo(({ dir, commit }) => {
        const published = commit('therr-services/users-service/index.ts', 'built here');
        commit('therr-services/users-service/index.ts', 'landed after the build');
        const tip = bash('git rev-parse HEAD', { cwd: dir });

        assert.strictEqual(
            inRepo(dir, `sources_changed_between ${published} ${tip} therr-services/users-service && echo stale`),
            'stale',
            'Code committed after the published build must read as stale.',
        );

        assert.strictEqual(
            inRepo(dir, `sources_changed_between ${tip} ${tip} therr-services/users-service || echo current`),
            'current',
        );

        // A change to a different service must not make this one look stale, or every
        // deploy blocks on every unrelated commit.
        commit('therr-services/maps-service/index.ts', 'unrelated');
        const tipAfterMaps = bash('git rev-parse HEAD', { cwd: dir });
        assert.strictEqual(
            inRepo(dir, `sources_changed_between ${tip} ${tipAfterMaps} therr-services/users-service || echo current`),
            'current',
        );
    });
}

{
    // An unresolvable "from" (shallow clone, deleted branch) must not read as stale:
    // blocking the deploy there would be blocking on checkout depth, not on code.
    withRepo(({ dir, commit }) => {
        commit('therr-services/users-service/index.ts', 'only commit');
        const tip = bash('git rev-parse HEAD', { cwd: dir });
        const bogus = '0123456789012345678901234567890123456789';

        const output = inRepo(dir, `sources_changed_between ${bogus} ${tip} therr-services/users-service || echo not-stale`);
        assert.match(output, /not-stale/);
        assert.match(output, /Cannot resolve/, 'and it must say why, rather than passing quietly');
    });
}

{
    // promoted_tip: on a real stage->main merge, the promoted revision is HEAD^2 — the
    // stage tip — not HEAD^1, which is only the previous state of main.
    withRepo(({ dir, git, commit }) => {
        commit('README.md', 'base');
        git('branch stage');
        const mainTip = commit('README.md', 'main moves on');

        git('checkout -q stage');
        const stageTip = commit('therr-services/users-service/index.ts', 'stage work');

        git('checkout -q general');
        git('merge -q --no-ff stage -m "Merge stage"');

        assert.strictEqual(inRepo(dir, 'promoted_tip'), stageTip);
        assert.notStrictEqual(inRepo(dir, 'promoted_tip'), mainTip);
    });
}

{
    // ...and when the promotion is fast-forwarded or squashed there is no second
    // parent. HEAD is then genuinely the promoted tip, and the helper must say so
    // rather than erroring — this is the shape that made `git diff HEAD^1` report a
    // one-file change and skip every service.
    withRepo(({ dir, commit }) => {
        const tip = commit('therr-services/users-service/index.ts', 'squashed promotion');
        assert.strictEqual(inRepo(dir, 'promoted_tip'), tip);
    });
}

{
    // The scenario that started this: two merges to stage before one promotion to main.
    // Under the old single-SHA file the deploy resolved users-service to the SHA of the
    // maps-service build. Asserted here as the staleness check firing, which is what
    // now turns that into a refusal instead of a 404 mid-rollout.
    withRepo(({ dir, commit }) => {
        const usersBuild = commit('therr-services/users-service/index.ts', 'users change');
        const mapsBuild = commit('therr-services/maps-service/index.ts', 'maps change');

        // Correct ledger: each service points at its own build. Neither is stale.
        assert.strictEqual(
            inRepo(dir, `sources_changed_between ${usersBuild} ${mapsBuild} therr-services/users-service || echo ok`),
            'ok',
        );
        assert.strictEqual(
            inRepo(dir, `sources_changed_between ${mapsBuild} ${mapsBuild} therr-services/maps-service || echo ok`),
            'ok',
        );

        // The old behaviour — users-service pointed at the maps-service build — is only
        // safe because that build is newer. Reverse the merge order and it is not, and
        // the check has to catch it.
        const laterUsersBuild = commit('therr-services/users-service/index.ts', 'more users work');
        assert.strictEqual(
            inRepo(dir, `sources_changed_between ${mapsBuild} ${laterUsersBuild} therr-services/users-service && echo stale`),
            'stale',
            'An image published before the service\'s latest commit must read as stale.',
        );
    });
}

console.log('deploy-plan: all assertions passed');
