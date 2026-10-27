// Integrity checks on the concurrent-index gate itself — the same two silent failure modes
// migration-idempotency-cutoff.test.js guards against: a cutoff moved forward past a migration
// that does not pass, and a rule registered in the plugin but never switched on.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Linter } = require('eslint');

const { MIGRATION_CONCURRENT_INDEX_CUTOFF } = require('../../migration-concurrent-index-cutoff');
const createServiceConfig = require('../../service');
const rule = require('../rules/require-concurrent-index');

const RULE_NAME = 'therr/require-concurrent-index';
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SERVICES_DIR = path.join(REPO_ROOT, 'therr-services');

// --- The cutoff is well-formed and in the past -------------------------------------------

assert.match(
    MIGRATION_CONCURRENT_INDEX_CUTOFF,
    /^\d{14}$/,
    `MIGRATION_CONCURRENT_INDEX_CUTOFF must be a YYYYMMDDHHMMSS migration timestamp, got "${MIGRATION_CONCURRENT_INDEX_CUTOFF}".`,
);

const nowStamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

assert.ok(
    MIGRATION_CONCURRENT_INDEX_CUTOFF <= nowStamp,
    `MIGRATION_CONCURRENT_INDEX_CUTOFF (${MIGRATION_CONCURRENT_INDEX_CUTOFF}) is in the future (now ${nowStamp}), which `
    + 'exempts every migration anyone writes between now and then.',
);

// --- service.js actually enables the rule, with this cutoff ------------------------------

const serviceConfig = createServiceConfig(path.join(SERVICES_DIR, 'users-service'));

const migrationOverride = (serviceConfig.overrides || []).find((override) => (override.files || [])
    .some((pattern) => pattern.includes('src/store/migrations')));

assert.ok(migrationOverride, 'eslint-config/service.js has no override targeting src/store/migrations.');

const configured = migrationOverride.rules[RULE_NAME];

assert.ok(
    Array.isArray(configured) && configured[0] === 'error',
    `${RULE_NAME} must be set to 'error' in the migrations override of eslint-config/service.js; found `
    + `${JSON.stringify(configured)}.`,
);

assert.strictEqual(
    configured[1] && configured[1].since,
    MIGRATION_CONCURRENT_INDEX_CUTOFF,
    `${RULE_NAME} in eslint-config/service.js must use MIGRATION_CONCURRENT_INDEX_CUTOFF as its \`since\` option.`,
);

// --- Every migration at or after the cutoff passes the rule -------------------------------

const migrations = fs.readdirSync(SERVICES_DIR)
    .map((service) => path.join(SERVICES_DIR, service, 'src/store/migrations'))
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) => fs.readdirSync(dir)
        .filter((entry) => entry.endsWith('.js'))
        .map((entry) => path.join(dir, entry)));

assert.ok(migrations.length > 0, `Found no migration files under ${SERVICES_DIR} — this test is not checking anything.`);

const inScope = migrations.filter((file) => {
    const match = path.basename(file).match(/^(\d{14})_/);
    return !match || match[1] >= MIGRATION_CONCURRENT_INDEX_CUTOFF;
});

const linter = new Linter();
linter.defineRule(RULE_NAME, rule);

const failures = inScope.flatMap((file) => linter.verify(
    fs.readFileSync(file, 'utf8'),
    {
        parserOptions: { ecmaVersion: 2022, sourceType: 'script' },
        rules: { [RULE_NAME]: ['error', { since: MIGRATION_CONCURRENT_INDEX_CUTOFF }] },
    },
    file,
).map((message) => `  ${path.relative(REPO_ROOT, file)}:${message.line} ${message.message}`));

assert.strictEqual(
    failures.length,
    0,
    'Migrations at or after MIGRATION_CONCURRENT_INDEX_CUTOFF must build and drop indexes CONCURRENTLY. Either fix '
    + 'these, or — if the cutoff was moved forward — move it back:\n'
    + `${failures.join('\n')}\n`,
);

// eslint-disable-next-line no-console
console.log(
    `migration-concurrent-index-cutoff: cutoff ${MIGRATION_CONCURRENT_INDEX_CUTOFF}, `
    + `${inScope.length} of ${migrations.length} migration(s) in scope, all clean`,
);
