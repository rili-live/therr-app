const { RuleTester } = require('eslint');
const rule = require('../rules/require-concurrent-index');

const ruleTester = new RuleTester({
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

// Every case runs as a migration dated after the cutoff, so the rule is active. The cutoff
// itself is exercised by the `since` block at the bottom.
const IN_SCOPE = '/repo/therr-services/users-service/src/store/migrations/20261101000000_main.widgets.js';

const TRANSACTION_OFF = 'exports.config = { transaction: false };';

const INVALID_PROBE = [
    'const dropInvalidIndex = async (knex, schema, indexName) => {',
    '    const { rows } = await knex.raw(`SELECT 1 FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid',
    '        JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = ? AND c.relname = ? AND NOT i.indisvalid`,',
    '        [schema, indexName]);',
    '    if (rows.length) { await knex.raw("DROP INDEX CONCURRENTLY IF EXISTS " + schema + "." + indexName); }',
    '};',
].join('\n');

ruleTester.run('require-concurrent-index', rule, {
    valid: [
        {
            // The canonical shape: transaction opt-out, indisvalid probe, concurrent create and drop.
            filename: IN_SCOPE,
            code: [
                TRANSACTION_OFF,
                INVALID_PROBE,
                'exports.up = async (knex) => {',
                '    await dropInvalidIndex(knex, "main", "idx_a");',
                '    await knex.raw("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_a ON main.widgets (id)");',
                '};',
                'exports.down = (knex) => knex.raw("DROP INDEX CONCURRENTLY IF EXISTS main.idx_a");',
            ].join('\n'),
        },
        {
            // Invalid-index cleanup by an unconditional concurrent drop of the same name.
            filename: IN_SCOPE,
            code: [
                TRANSACTION_OFF,
                'exports.up = async (knex) => {',
                '    await knex.raw("DROP INDEX CONCURRENTLY IF EXISTS main.idx_a");',
                '    await knex.raw("CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_a ON main.\\"userInterests\\" (id)");',
                '};',
            ].join('\n'),
        },
        {
            // `module.exports = { config }` form of the opt-out.
            filename: IN_SCOPE,
            code: [
                'const up = async (knex) => {',
                '    await knex.raw("DROP INDEX CONCURRENTLY IF EXISTS main.idx_a");',
                '    await knex.raw("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_a ON main.widgets (id)");',
                '};',
                'module.exports = { up, config: { transaction: false } };',
            ].join('\n'),
        },
        {
            // Builder indexes inside createTable are on a brand-new, empty table.
            filename: IN_SCOPE,
            code: [
                'exports.up = async (knex) => {',
                '    if (!(await knex.schema.withSchema("habits").hasTable("widgets"))) {',
                '        await knex.schema.withSchema("habits").createTable("widgets", (table) => {',
                '            table.uuid("id").primary();',
                '            table.string("token").unique();',
                '            table.index(["userId", "status"]);',
                '        });',
                '    }',
                '};',
            ].join('\n'),
        },
        {
            // A raw index on a table the same function creates is exempt for the same reason.
            filename: IN_SCOPE,
            code: [
                'exports.up = async (knex) => {',
                '    if (!(await knex.schema.withSchema("habits").hasTable("widgets"))) {',
                '        await knex.schema.withSchema("habits").createTable("widgets", (t) => { t.uuid("id"); });',
                '    }',
                '    await knex.raw("CREATE INDEX IF NOT EXISTS idx_w ON habits.widgets (lower(name))");',
                '};',
            ].join('\n'),
        },
        {
            // ...including when the table is created in raw SQL.
            filename: IN_SCOPE,
            code: [
                'exports.up = async (knex) => {',
                '    await knex.raw("CREATE TABLE IF NOT EXISTS habits.widgets (id uuid)");',
                '    await knex.raw("CREATE INDEX IF NOT EXISTS idx_w ON habits.widgets (id)");',
                '};',
            ].join('\n'),
        },
        {
            // REFRESH MATERIALIZED VIEW CONCURRENTLY runs fine inside a transaction.
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw("REFRESH MATERIALIZED VIEW CONCURRENTLY main.mv");',
        },
        {
            // SQL comments mentioning CREATE INDEX are not statements.
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw("-- CREATE INDEX idx_a ON main.widgets (id)\\nSELECT 1");',
        },
        {
            // Migrations before the cutoff are exempt.
            filename: '/repo/therr-services/users-service/src/store/migrations/20260101000000_main.widgets.js',
            options: [{ since: '20261023000000' }],
            code: 'exports.up = (knex) => knex.raw("CREATE INDEX IF NOT EXISTS idx_a ON main.widgets (id)");',
        },
    ],

    invalid: [
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw("CREATE INDEX IF NOT EXISTS idx_a ON main.widgets (id)");',
            errors: [{ messageId: 'createNotConcurrent' }],
        },
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS idx_a\n  ON main."users" (lower(email))`);',
            errors: [{ messageId: 'createNotConcurrent' }],
        },
        {
            // A SQL-named constant handed to raw() later is still checked.
            filename: IN_SCOPE,
            code: [
                'const createIndexSql = "CREATE INDEX IF NOT EXISTS idx_a ON main.widgets (id)";',
                'exports.up = (knex) => knex.raw(createIndexSql);',
            ].join('\n'),
            errors: [{ messageId: 'createNotConcurrent' }],
        },
        {
            filename: IN_SCOPE,
            code: 'exports.down = (knex) => knex.raw("DROP INDEX IF EXISTS main.idx_a");',
            errors: [{ messageId: 'dropNotConcurrent' }],
        },
        {
            // A createTable in `down` cannot exempt an index built in `up`.
            filename: IN_SCOPE,
            code: [
                'exports.up = (knex) => knex.raw("CREATE INDEX IF NOT EXISTS idx_w ON habits.widgets (id)");',
                'exports.down = (knex) => knex.schema.withSchema("habits").createTable("widgets", (t) => { t.uuid("id"); });',
            ].join('\n'),
            errors: [{ messageId: 'createNotConcurrent' }],
        },
        {
            // Concurrent, but knex's transaction would make it fail at deploy.
            filename: IN_SCOPE,
            code: [
                INVALID_PROBE,
                'exports.up = (knex) => knex.raw("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_a ON main.widgets (id)");',
            ].join('\n'),
            errors: [{ messageId: 'needsTransactionFalse' }],
        },
        {
            filename: IN_SCOPE,
            code: [
                'exports.config = { transaction: true };',
                'exports.down = (knex) => knex.raw("DROP INDEX CONCURRENTLY IF EXISTS main.idx_a");',
            ].join('\n'),
            errors: [{ messageId: 'needsTransactionFalse' }],
        },
        {
            // No invalid-index cleanup.
            filename: IN_SCOPE,
            code: [
                TRANSACTION_OFF,
                'exports.up = (knex) => knex.raw("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_a ON main.widgets (id)");',
            ].join('\n'),
            errors: [{ messageId: 'needsInvalidIndexCleanup' }],
        },
        {
            // A drop of a different index does not clean up this one, and a drop in `down`
            // does not clean up for `up`.
            filename: IN_SCOPE,
            code: [
                TRANSACTION_OFF,
                'exports.up = async (knex) => {',
                '    await knex.raw("DROP INDEX CONCURRENTLY IF EXISTS main.idx_other");',
                '    await knex.raw("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_a ON main.widgets (id)");',
                '};',
                'exports.down = (knex) => knex.raw("DROP INDEX CONCURRENTLY IF EXISTS main.idx_a");',
            ].join('\n'),
            errors: [{ messageId: 'needsInvalidIndexCleanup' }],
        },
        {
            // Builder index ops on an existing table.
            filename: IN_SCOPE,
            code: [
                'exports.up = (knex) => knex.schema.withSchema("main").alterTable("widgets", (table) => {',
                '    table.index(["userId"]);',
                '    table.string("token").unique();',
                '});',
                'exports.down = (knex) => knex.schema.withSchema("main").table("widgets", (table) => {',
                '    table.dropIndex(["userId"]);',
                '});',
            ].join('\n'),
            errors: [
                { messageId: 'builderIndexOnExistingTable' },
                { messageId: 'builderIndexOnExistingTable' },
                { messageId: 'builderIndexOnExistingTable' },
            ],
        },
        {
            // Exactly at the cutoff is in scope — the cutoff is inclusive.
            filename: '/repo/therr-services/users-service/src/store/migrations/20261023000000_main.widgets.js',
            options: [{ since: '20261023000000' }],
            code: 'exports.up = (knex) => knex.raw("CREATE INDEX IF NOT EXISTS idx_a ON main.widgets (id)");',
            errors: [{ messageId: 'createNotConcurrent' }],
        },
        {
            // An off-convention filename gets no exemption.
            filename: '/repo/therr-services/users-service/src/store/migrations/add-widgets.js',
            options: [{ since: '20261023000000' }],
            code: 'exports.up = (knex) => knex.raw("CREATE INDEX IF NOT EXISTS idx_a ON main.widgets (id)");',
            errors: [{ messageId: 'createNotConcurrent' }],
        },
    ],
});

// eslint-disable-next-line no-console
console.log('require-concurrent-index: all cases passed');
