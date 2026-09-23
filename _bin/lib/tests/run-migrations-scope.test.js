// Tests for the two decisions run-migrations.sh makes that the deploy plan does not:
// which services a partially-failed rollout leaves safe to migrate, and whether a
// pod's schema is actually caught up with the code it is running.
//
// Both exist because of the 2026-09-20 deploy. deploy_waves failed on an unrelated
// ImagePullBackOff, `set -e` ended the job before the migration step, and
// users-service — already rolled onto the savings build by an earlier wave — served
// new code against a pre-savings schema. `POST /habits/checkins` 500'd on
// `column "savedAmount" of relation "habit_checkins" does not exist` for two days.
//
// So deploy.sh now traps that failure and migrates what rolled. The dangerous half of
// that change is the scope: get it wrong in the permissive direction and a *total*
// rollout failure migrates every service underneath code that never moved, which is
// precisely what the wave ordering exists to prevent. Hence the empty-list test below
// — set-but-empty and unset have to keep meaning opposite things.
//
// The verify pass is the other half. It asks each pod directly rather than reading the
// deploy plan, because the plan answers "did *this* deploy add migrations" and the
// outage turned on migrations added by a deploy that had already reported done. Its
// parse must fail closed: a "0 pending" produced by a regex that stopped matching is
// the same false green the pass was written to catch.

const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, '_bin', 'cicd', 'run-migrations.sh');

// Sources run-migrations.sh so its functions can be called directly. CICD_BRANCH is
// set to something other than main so the `main "$@"` call at the bottom returns
// immediately without touching kubectl.
const run = (snippet, env = {}) => execFileSync('bash', ['-c', `
    source "${SCRIPT}" >/dev/null 2>&1
    ${snippet}
`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, CICD_BRANCH: 'general', ...env },
}).trim();

// A throwaway `kubectl` earlier on PATH than the real one, printing `stdout` and
// exiting `code` for any invocation.
const withFakeKubectl = ({ stdout, code = 0 }, snippet, env = {}) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-migrations-kubectl-'));
    const bin = path.join(dir, 'kubectl');

    fs.writeFileSync(bin, `#!/bin/bash\ncat <<'FAKE_EOF'\n${stdout}\nFAKE_EOF\nexit ${code}\n`);
    fs.chmodSync(bin, 0o755);

    try {
        return run(snippet, { ...env, PATH: `${dir}${path.delimiter}${process.env.PATH}` });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

const scope = (snippet, env) => run(
    `${snippet} && echo IN_SCOPE || echo OUT_OF_SCOPE`,
    env,
);

// --- Scope: which services a partial rollout leaves safe to migrate ---------------------------

{
    // No restriction in force — a standalone run, or an older deploy.sh that does not
    // export the variable at all. Every migratable service is in scope.
    const output = scope("service_in_scope 'users-service'");
    assert.strictEqual(output, 'IN_SCOPE', 'An unset restriction must leave every service in scope.');
}

{
    // The ordinary partial-failure case: some services rolled, others did not.
    const env = { MIGRATE_ONLY_SERVICES: 'users-service maps-service' };

    assert.strictEqual(
        scope("service_in_scope 'users-service'", env),
        'IN_SCOPE',
        'A service that reached its desired tag must be migrated.',
    );
    assert.strictEqual(
        scope("service_in_scope 'messages-service'", env),
        'OUT_OF_SCOPE',
        'A service that never rolled must not be migrated underneath.',
    );
}

{
    // The case this test file exists for. deploy.sh always exports the variable, so an
    // empty value means "nothing rolled" — not "no restriction". Collapsed with
    // `${VAR:-}` the two are indistinguishable, and a deploy whose very first wave
    // failed would migrate every service in the cluster underneath code that never
    // moved. That is a worse outcome than the outage this whole change is fixing.
    const output = scope("service_in_scope 'users-service'", { MIGRATE_ONLY_SERVICES: '' });

    assert.strictEqual(
        output,
        'OUT_OF_SCOPE',
        'An empty restriction means nothing rolled, so nothing may be migrated.',
    );
}

{
    // Matched whole-word, not by substring, so a key that contains another cannot be
    // mistaken for it.
    assert.strictEqual(
        scope("service_in_scope 'users'", { MIGRATE_ONLY_SERVICES: 'users-service' }),
        'OUT_OF_SCOPE',
        'A prefix of a listed key must not match it.',
    );
}

// --- The registry predicate deploy.sh filters on -----------------------------------------------

{
    const migratable = (key) => run(`is_migratable_service '${key}' && echo YES || echo NO`);

    assert.strictEqual(migratable('users-service'), 'YES');
    assert.strictEqual(migratable('maps-service'), 'YES');

    // Deliberately absent from THERR_MIGRATABLE_SERVICES: its knexfile points at
    // maps-service's database against an empty migrations directory, so migrating it
    // aborts with "The migration directory is corrupt". See the registry's own note.
    assert.strictEqual(migratable('push-notifications-service'), 'NO');

    // Not a backend service at all.
    assert.strictEqual(migratable('client-web'), 'NO');
}

// --- The verify pass's parse -------------------------------------------------------------------

{
    // knex's own `migrate:list` output shape.
    const output = withFakeKubectl(
        { stdout: 'Found 7 Completed Migration file/files.\nFound 2 Pending Migration file/files.' },
        'pending_migration_count pod-1 users-service',
    );

    assert.strictEqual(output, '2', `Must read the pending count. Got:\n${output}`);
}

{
    // A caught-up service. knex never prints "Found 0 Pending" — with nothing pending it
    // prints a different sentence entirely (bin/utils/migrationsLister.js), wrapped in
    // colorette's red. Missed, every healthy service reads as unknown and every deploy
    // fails once its images carry migrations:status.
    const output = withFakeKubectl(
        { stdout: 'Found 9 Completed Migration file/files.\n\u001b[31mNo Pending Migration files Found.\u001b[39m' },
        'pending_migration_count pod-1 users-service',
    );

    assert.strictEqual(output, '0', `Zero pending must read as zero, not as unknown. Got:\n${output}`);
}

{
    // A fresh database: neither completed nor pending. Still zero, not unknown.
    const output = withFakeKubectl(
        { stdout: 'No Completed Migration files Found.\nNo Pending Migration files Found.' },
        'pending_migration_count pod-1 users-service',
    );

    assert.strictEqual(output, '0', `An empty ledger with nothing pending must read as zero. Got:\n${output}`);
}

{
    // chalk wraps that line in colour codes when it thinks it has a TTY. kubectl exec
    // without -t does not, but the parse must not depend on that.
    const output = withFakeKubectl(
        { stdout: '\u001b[36m\u001b[1mFound 3 Pending Migration file/files.\u001b[22m\u001b[39m' },
        'pending_migration_count pod-1 users-service',
    );

    assert.strictEqual(output, '3', `Colour codes must not defeat the parse. Got:\n${output}`);
}

{
    // A pod whose image predates the migrations:status script. This is the expected
    // state for any service the deploy did not move, until this change has rolled
    // everywhere — the pod is reporting its own age, not failing a check, so it must
    // be distinguishable from a parse that broke.
    const output = withFakeKubectl(
        { stdout: 'npm error Missing script: "migrations:status"', code: 1 },
        'pending_migration_count pod-1 users-service',
    );

    assert.strictEqual(output, 'unsupported', `A missing script must be named as such. Got:\n${output}`);
}

{
    // Fail closed. If knex ever stops printing that line, the answer is "unknown" —
    // which the caller escalates — and never a silent zero.
    const output = withFakeKubectl(
        { stdout: 'some future knex output that says nothing about pending migrations' },
        'pending_migration_count pod-1 users-service',
    );

    assert.strictEqual(output, '', `An unrecognised format must not read as zero pending. Got:\n${output}`);
}

{
    // Same when the exec itself fails.
    const output = withFakeKubectl(
        { stdout: 'error: unable to upgrade connection: container not found', code: 1 },
        'pending_migration_count pod-1 users-service',
    );

    assert.strictEqual(output, '', `A failed exec must not read as zero pending. Got:\n${output}`);
}

// --- Argument handling -------------------------------------------------------------------------

{
    // --help must not fall through to the cluster.
    const output = run('main --help');
    assert.ok(output.includes('--verify-only'), `--help must describe the flags. Got:\n${output}`);
}

{
    // An unknown flag fails rather than being ignored, so a typo in a recovery command
    // does not quietly run the full deploy-mode pass instead.
    const output = execFileSync('bash', ['-c', `
        source "${SCRIPT}" >/dev/null 2>&1
        main --sevice users-service >/dev/null 2>&1 && echo ACCEPTED || echo REJECTED
    `], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, CICD_BRANCH: 'general' },
    }).trim();

    assert.strictEqual(output, 'REJECTED', 'An unknown option must fail.');
}

{
    // The branch gate applies to the deploy path only. A standalone recovery run is the
    // supported way to fix a cluster whose deploy died before its migration step, and it
    // must not silently no-op because the CI branch variable says something else.
    const output = withFakeKubectl(
        { stdout: 'No Pending Migration files Found.' },
        'main --verify-only',
        { CICD_BRANCH: 'general' },
    );

    assert.ok(
        !output.includes('skipping automated migrations'),
        `--verify-only must not be gated on the branch. Got:\n${output}`,
    );
}

console.log('run-migrations-scope: all assertions passed');
