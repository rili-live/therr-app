// Integrity checks on the idempotency gate itself.
//
// `therr/require-idempotent-migration` exempts every migration dated before
// MIGRATION_IDEMPOTENCY_CUTOFF. That exemption is the whole reason the rule could be turned
// on at all — but it is also the obvious way to make the rule stop gating anything, and both
// failure modes are silent:
//
//   1. Move the cutoff forward past a migration that does not pass, and lint goes green while
//      the migration that would have been caught ships. Nothing else in the repo would notice;
//      the rule is still "enabled" and its unit tests still pass.
//   2. Register the rule in the plugin but never enable it in eslint-config/service.js, and it
//      is dead weight — unit-tested, wired to nothing.
//
// So: the cutoff must be in the past, every migration at or after it must actually be clean,
// and service.js must switch the rule on with this exact cutoff.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Linter } = require('eslint');

const { MIGRATION_IDEMPOTENCY_CUTOFF } = require('../../migration-idempotency-cutoff');
const createServiceConfig = require('../../service');
const rule = require('../rules/require-idempotent-migration');

const RULE_NAME = 'therr/require-idempotent-migration';
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SERVICES_DIR = path.join(REPO_ROOT, 'therr-services');

// --- The cutoff is well-formed and in the past -------------------------------------------

assert.match(
    MIGRATION_IDEMPOTENCY_CUTOFF,
    /^\d{14}$/,
    `MIGRATION_IDEMPOTENCY_CUTOFF must be a YYYYMMDDHHMMSS migration timestamp, got "${MIGRATION_IDEMPOTENCY_CUTOFF}".`,
);

const nowStamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

assert.ok(
    MIGRATION_IDEMPOTENCY_CUTOFF <= nowStamp,
    `MIGRATION_IDEMPOTENCY_CUTOFF (${MIGRATION_IDEMPOTENCY_CUTOFF}) is in the future (now ${nowStamp}), which `
    + 'exempts every migration anyone writes between now and then. The cutoff exists to spare the already-deployed '
    + 'back catalogue, not to defer the rule.',
);

// --- service.js actually enables the rule, with this cutoff ------------------------------

const serviceConfig = createServiceConfig(path.join(SERVICES_DIR, 'users-service'));

const migrationOverride = (serviceConfig.overrides || []).find((override) => (override.files || [])
    .some((pattern) => pattern.includes('src/store/migrations')));

assert.ok(
    migrationOverride,
    'eslint-config/service.js has no override targeting src/store/migrations — nothing enables the '
    + 'migration-only rules for the files they exist to check.',
);

const configured = migrationOverride.rules[RULE_NAME];

assert.ok(
    Array.isArray(configured) && configured[0] === 'error',
    `${RULE_NAME} must be set to 'error' in the migrations override of eslint-config/service.js; found `
    + `${JSON.stringify(configured)}.`,
);

assert.strictEqual(
    configured[1] && configured[1].since,
    MIGRATION_IDEMPOTENCY_CUTOFF,
    `${RULE_NAME} in eslint-config/service.js must use MIGRATION_IDEMPOTENCY_CUTOFF as its \`since\` option, so `
    + 'this test and the lint run agree on which migrations are in scope.',
);

// --- Every migration at or after the cutoff passes the rule -------------------------------

const collectMigrations = () => fs.readdirSync(SERVICES_DIR)
    .map((service) => path.join(SERVICES_DIR, service, 'src/store/migrations'))
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) => fs.readdirSync(dir)
        .filter((entry) => entry.endsWith('.js'))
        .map((entry) => path.join(dir, entry)));

const migrations = collectMigrations();

assert.ok(
    migrations.length > 0,
    `Found no migration files under ${SERVICES_DIR} — this test is not actually checking anything.`,
);

const inScope = migrations.filter((file) => {
    const match = path.basename(file).match(/^(\d{14})_/);
    // No timestamp prefix means no exemption, matching the rule.
    return !match || match[1] >= MIGRATION_IDEMPOTENCY_CUTOFF;
});

const linter = new Linter();
linter.defineRule(RULE_NAME, rule);

const failures = inScope.flatMap((file) => linter.verify(
    fs.readFileSync(file, 'utf8'),
    {
        parserOptions: { ecmaVersion: 2022, sourceType: 'script' },
        rules: { [RULE_NAME]: ['error', { since: MIGRATION_IDEMPOTENCY_CUTOFF }] },
    },
    file,
).map((message) => `  ${path.relative(REPO_ROOT, file)}:${message.line} ${message.message}`));

assert.strictEqual(
    failures.length,
    0,
    'Migrations at or after MIGRATION_IDEMPOTENCY_CUTOFF must be idempotent. Either fix these, or — if the '
    + 'cutoff was moved forward — move it back:\n'
    + `${failures.join('\n')}\n`,
);

// eslint-disable-next-line no-console
console.log(
    `migration-idempotency-cutoff: cutoff ${MIGRATION_IDEMPOTENCY_CUTOFF}, `
    + `${inScope.length} of ${migrations.length} migration(s) in scope, all clean`,
);
