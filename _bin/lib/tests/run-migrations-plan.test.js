// Tests for how run-migrations.sh reads the deploy plan written by deploy.sh.
//
// The whole point of the plan file is that migrations are gated on the version
// range a service actually moved through, instead of on `git diff HEAD^1` — which
// leaves migrations unrun, with a green build, whenever a previous deploy skipped
// the service. So the failure mode that matters here is not a crash: it is a row
// that parses wrong and quietly drops the service back onto the HEAD^1 fallback.
//
// The plan is TSV and its second column (the running tag) is legitimately empty for
// a first-ever rollout, or when `kubectl get` fails at plan time. That empty field is
// what a whitespace-delimited `read` loses — including a tab-delimited one, since
// `read` skips leading separators whenever IFS holds nothing but whitespace.

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, '_bin', 'cicd', 'run-migrations.sh');

// Sources run-migrations.sh so its functions can be called directly. CICD_BRANCH is
// set to something other than main so the `main` call at the bottom of the script
// returns immediately without touching kubectl.
const withPlan = (rows, snippet) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-migrations-plan-'));
    const planFile = path.join(dir, 'deploy-plan.tsv');

    if (rows !== null) {
        fs.writeFileSync(planFile, `${rows.map((row) => row.join('\t')).join('\n')}\n`);
    }

    try {
        return execFileSync('bash', ['-c', `
            source "${SCRIPT}" >/dev/null 2>&1
            ${snippet}
        `], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env: {
                ...process.env,
                CICD_BRANCH: 'general',
                DEPLOY_PLAN_FILE: planFile,
            },
        }).trim();
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

// A verdict probe that also reveals whether the row was found at all: the fallback
// path prints "No deploy plan row", and that string appearing is itself the bug.
const probe = (rows, key) => withPlan(
    rows,
    `migrations_pending_for '${key}' therr-services/${key} && echo VERDICT=pending || echo VERDICT=skipped`,
);

const HEAD = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();

// --- The case this exists for -----------------------------------------------------------------

{
    // No running tag — a Deployment that does not exist yet, or a kubectl blip while
    // the plan was being computed. The row still says "deploy", so the range is
    // unknown and migrations must run to be safe.
    //
    // Read space-delimited, this row parses one column short: the verdict lands in
    // $DESIRED, $VERDICT comes back empty, and the service is handed to the HEAD^1
    // merge diff — the exact detection the plan file replaced.
    const output = probe([['users-service', '', HEAD, 'deploy']], 'users-service');

    assert.ok(
        !output.includes('No deploy plan row'),
        `A row with an empty running tag must still be found in the plan. Got:\n${output}`,
    );
    assert.ok(
        output.includes('No resolvable previous version'),
        `An empty running tag must be recognised as "no range to inspect". Got:\n${output}`,
    );
    assert.ok(output.includes('VERDICT=pending'), `Must migrate when the previous version is unknown. Got:\n${output}`);
}

// --- The ordinary paths -----------------------------------------------------------------------

{
    // Both tags present and equal: the service moved through no commits at all, so
    // there is nothing to migrate.
    const output = probe([['users-service', HEAD, HEAD, 'deploy']], 'users-service');

    assert.ok(!output.includes('No deploy plan row'), `Row must be found. Got:\n${output}`);
    assert.ok(!output.includes('No resolvable previous version'), `${HEAD} must resolve. Got:\n${output}`);
    assert.ok(output.includes('VERDICT=skipped'), `An empty version range must not migrate. Got:\n${output}`);
}

{
    // A service the deploy did not move cannot have new migrations to run, whatever
    // the git range says.
    const output = probe([['maps-service', HEAD, HEAD, 'up-to-date']], 'maps-service');

    assert.ok(!output.includes('No deploy plan row'), `Row must be found. Got:\n${output}`);
    assert.ok(output.includes('VERDICT=skipped'), `A non-"deploy" verdict must not migrate. Got:\n${output}`);
}

{
    // Rows are matched on the key, not on position: a plan listing other services
    // first must not hand their tags to this one.
    const row = withPlan([
        ['client-web', 'aaaaaaa', 'bbbbbbb', 'deploy'],
        ['users-service', '', 'ccccccc', 'unpublished'],
    ], 'plan_row_for users-service');

    assert.strictEqual(
        row,
        '|ccccccc|unpublished',
        'Must return the users-service row, with its empty running column intact.',
    );
}

// --- No plan file / no row ---------------------------------------------------------------------

{
    // An unknown key yields nothing, which is what sends the caller to the fallback.
    assert.strictEqual(withPlan([['users-service', '', HEAD, 'deploy']], 'plan_row_for nope-service'), '');

    // Same when deploy.sh never wrote a plan at all (this script run by hand).
    assert.strictEqual(withPlan(null, 'plan_row_for users-service'), '');
}

console.log('run-migrations-plan: all assertions passed');
