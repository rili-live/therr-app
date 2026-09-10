const { RuleTester } = require('eslint');
const rule = require('../rules/require-idempotent-migration');

const ruleTester = new RuleTester({
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

// Every case runs as a migration dated after the cutoff, so the rule is active. The cutoff
// itself is exercised by the `since` block at the bottom.
const IN_SCOPE = '/repo/therr-services/users-service/src/store/migrations/20260801000000_main.widgets.js';

ruleTester.run('require-idempotent-migration', rule, {
    valid: [
        // --- Group 1: the idempotent counterparts ------------------------------------------
        {
            filename: IN_SCOPE,
            code: 'exports.down = (knex) => knex.schema.withSchema("main").dropTableIfExists("widgets");',
        },
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.schema.createSchemaIfNotExists("habits");',
        },
        {
            filename: IN_SCOPE,
            code: 'exports.down = (knex) => knex.schema.dropSchemaIfExists("habits");',
        },

        // --- Group 2: probes --------------------------------------------------------------
        {
            // The canonical shape: probe, then create only if absent.
            filename: IN_SCOPE,
            code: [
                'exports.up = async (knex) => {',
                '    if (!(await knex.schema.withSchema("main").hasTable("widgets"))) {',
                '        await knex.schema.withSchema("main").createTable("widgets", (table) => {',
                '            table.uuid("id").primary();',
                '        });',
                '    }',
                '};',
            ].join('\n'),
        },
        {
            // Probe written as an early return rather than an enclosing `if`.
            filename: IN_SCOPE,
            code: [
                'exports.up = async (knex) => {',
                '    const exists = await knex.schema.withSchema("main").hasColumn("widgets", "colour");',
                '    if (exists) { return; }',
                '    await knex.schema.withSchema("main").alterTable("widgets", (table) => {',
                '        table.string("colour", 50);',
                '    });',
                '};',
            ].join('\n'),
        },
        {
            // ALTER COLUMN re-applies cleanly, so a chain terminating in .alter() needs no probe.
            filename: IN_SCOPE,
            code: [
                'exports.up = (knex) => knex.schema.withSchema("main").alterTable("widgets", (table) => {',
                '    table.string("colour", 500).notNullable().alter();',
                '});',
            ].join('\n'),
        },
        {
            // DROP NOT NULL on an already-nullable column is a no-op in Postgres.
            filename: IN_SCOPE,
            code: [
                'exports.up = (knex) => knex.schema.withSchema("main").alterTable("widgets", (table) => {',
                '    table.dropNullable("colour");',
                '});',
            ].join('\n'),
        },
        {
            // `knex.table(name)` without a builder callback is a query builder, not DDL.
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.table("widgets").update({ isEnabled: true });',
        },

        // --- Group 3: raw SQL that carries its guard --------------------------------------
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw("CREATE INDEX IF NOT EXISTS idx_a ON main.widgets (\\"userId\\")");',
        },
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw("CREATE UNIQUE INDEX IF NOT EXISTS idx_a ON main.widgets (\\"userId\\")");',
        },
        {
            filename: IN_SCOPE,
            code: 'exports.down = (knex) => knex.raw("DROP INDEX IF EXISTS main.idx_a");',
        },
        {
            filename: IN_SCOPE,
            code: 'exports.down = (knex) => knex.raw("DROP INDEX CONCURRENTLY IF EXISTS main.idx_a");',
        },
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw(`ALTER TABLE main.widgets ADD COLUMN IF NOT EXISTS "colour" text`);',
        },
        {
            // The drop-first idiom for a statement Postgres gives no IF NOT EXISTS.
            filename: IN_SCOPE,
            code: [
                'exports.up = (knex) => knex.raw(`',
                '    ALTER TABLE main.widgets DROP CONSTRAINT IF EXISTS chk_widgets_status;',
                '    ALTER TABLE main.widgets ADD CONSTRAINT chk_widgets_status CHECK ("status" IN (\'a\'));',
                '`);',
            ].join('\n'),
        },
        {
            // The same idiom split across two `knex.raw()` calls, which is how it is normally
            // written. Pairing has to reach across literals or this — the shape we want — fails.
            filename: IN_SCOPE,
            code: [
                'exports.up = async (knex) => {',
                '    await knex.raw(\'ALTER TABLE main.widgets DROP CONSTRAINT IF EXISTS chk_widgets_status\');',
                '    await knex.raw(\'ALTER TABLE main.widgets ADD CONSTRAINT chk_widgets_status CHECK (true)\');',
                '};',
            ].join('\n'),
        },
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw("CREATE OR REPLACE FUNCTION main.touch() RETURNS trigger AS 1 LANGUAGE sql");',
        },
        {
            // A DO block is Postgres' own conditional-DDL construct — the author handled it.
            filename: IN_SCOPE,
            code: [
                'exports.up = (knex) => knex.raw(`',
                '    DO $$ BEGIN',
                '        ALTER TABLE main.widgets ADD CONSTRAINT chk_widgets_status CHECK (true);',
                '    EXCEPTION WHEN duplicate_object THEN NULL;',
                '    END $$;',
                '`);',
            ].join('\n'),
        },
        {
            // A guard keyword sitting in a SQL comment must not count, but must not false-positive
            // the surrounding statement either.
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw("-- CREATE INDEX idx_old ON main.widgets (id)\\nSELECT 1");',
        },
        {
            // Prose is not DDL. Only `.raw()` arguments and SQL-named constants are scanned,
            // so a log line that happens to contain "drop table" stays quiet.
            filename: IN_SCOPE,
            code: 'const message = "drop table names into the report"; module.exports = { message };',
        },
        {
            // A guarded statement in a SQL-named constant.
            filename: IN_SCOPE,
            code: 'const createIndexSql = "CREATE INDEX IF NOT EXISTS idx_a ON main.widgets (id)";',
        },

        // --- The cutoff -------------------------------------------------------------------
        {
            // Dated before the cutoff: exempt, however non-idempotent it is.
            filename: '/repo/therr-services/users-service/src/store/migrations/20200101000000_main.widgets.js',
            options: [{ since: '20260730000000' }],
            code: 'exports.down = (knex) => knex.schema.dropTable("widgets");',
        },
    ],

    invalid: [
        // --- Group 1 ----------------------------------------------------------------------
        {
            filename: IN_SCOPE,
            code: 'exports.down = (knex) => knex.schema.withSchema("main").dropTable("widgets");',
            errors: [{ messageId: 'dropInReplacement', data: { method: 'dropTable', replacement: 'dropTableIfExists' } }],
        },
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.schema.createSchema("habits");',
            errors: [{ messageId: 'dropInReplacement' }],
        },
        {
            // Computed member access must not be an escape hatch.
            filename: IN_SCOPE,
            code: 'exports.down = (knex) => knex.schema["dropTable"]("widgets");',
            errors: [{ messageId: 'dropInReplacement' }],
        },
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.schema.createTableIfNotExists("widgets", (table) => { table.uuid("id"); });',
            errors: [{ messageId: 'deprecatedCreateTableIfNotExists' }],
        },

        // --- Group 2 ----------------------------------------------------------------------
        {
            // The shape of the real 20260511000000_main.spaceCorrections.js migration.
            filename: IN_SCOPE,
            code: [
                'exports.up = (knex) => knex.schema.withSchema("main").createTable("widgets", (table) => {',
                '    table.uuid("id").primary().notNullable();',
                '});',
            ].join('\n'),
            errors: [{ messageId: 'needsProbe', data: { method: 'createTable', name: 'widgets' } }],
        },
        {
            filename: IN_SCOPE,
            code: [
                'exports.up = (knex) => knex.schema.withSchema("main").alterTable("widgets", (table) => {',
                '    table.string("brandVariation", 50).notNullable().defaultTo("therr");',
                '});',
            ].join('\n'),
            errors: [{ messageId: 'unguardedAlter', data: { method: 'alterTable', name: 'widgets' } }],
        },
        {
            // `.index([...])` compiles to a bare CREATE INDEX — not repeatable.
            filename: IN_SCOPE,
            code: [
                'exports.up = (knex) => knex.schema.withSchema("main").alterTable("widgets", (table) => {',
                '    table.index(["userId", "createdAt"]);',
                '});',
            ].join('\n'),
            errors: [{ messageId: 'unguardedAlter' }],
        },
        {
            filename: IN_SCOPE,
            code: [
                'exports.down = (knex) => knex.schema.withSchema("main").table("widgets", (table) => {',
                '    table.dropColumn("colour");',
                '});',
            ].join('\n'),
            errors: [{ messageId: 'unguardedAlter', data: { method: 'table', name: 'widgets' } }],
        },
        {
            // A probe in `up` must not vouch for an unguarded statement in `down`.
            filename: IN_SCOPE,
            code: [
                'exports.up = async (knex) => {',
                '    if (!(await knex.schema.withSchema("main").hasColumn("widgets", "colour"))) {',
                '        await knex.schema.withSchema("main").alterTable("widgets", (t) => { t.string("colour"); });',
                '    }',
                '};',
                'exports.down = async (knex) => {',
                '    await knex.schema.withSchema("main").alterTable("widgets", (t) => { t.dropColumn("colour"); });',
                '};',
            ].join('\n'),
            errors: [{ messageId: 'unguardedAlter' }],
        },
        {
            // A probe naming a different table does not vouch for this one.
            filename: IN_SCOPE,
            code: [
                'exports.up = async (knex) => {',
                '    const hasOther = await knex.schema.withSchema("main").hasTable("gadgets");',
                '    if (!hasOther) { return; }',
                '    await knex.schema.withSchema("main").createTable("widgets", (t) => { t.uuid("id"); });',
                '};',
            ].join('\n'),
            errors: [{ messageId: 'needsProbe' }],
        },

        // --- Group 3 ----------------------------------------------------------------------
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw("CREATE INDEX idx_a ON main.widgets (\\"userId\\")");',
            errors: [{ messageId: 'rawMissingGuard', data: { statement: 'CREATE INDEX', guard: 'IF NOT EXISTS' } }],
        },
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw(`CREATE UNIQUE INDEX idx_a ON main."widgets" ("userId") WHERE "userId" IS NOT NULL`);',
            errors: [{ messageId: 'rawMissingGuard', data: { statement: 'CREATE INDEX', guard: 'IF NOT EXISTS' } }],
        },
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw("CREATE TABLE main.widgets (id uuid)");',
            errors: [{ messageId: 'rawMissingGuard', data: { statement: 'CREATE TABLE', guard: 'IF NOT EXISTS' } }],
        },
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw("CREATE SCHEMA habits");',
            errors: [{ messageId: 'rawMissingGuard', data: { statement: 'CREATE SCHEMA', guard: 'IF NOT EXISTS' } }],
        },
        {
            filename: IN_SCOPE,
            code: 'exports.down = (knex) => knex.raw("DROP INDEX main.idx_a");',
            errors: [{ messageId: 'rawMissingGuard', data: { statement: 'DROP INDEX', guard: 'IF EXISTS' } }],
        },
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw(`ALTER TABLE main.widgets ADD COLUMN "colour" text`);',
            errors: [{ messageId: 'rawMissingGuard', data: { statement: 'ADD COLUMN', guard: 'IF NOT EXISTS' } }],
        },
        {
            filename: IN_SCOPE,
            code: [
                'exports.up = (knex) => knex.raw(`',
                '    ALTER TABLE main."widgets"',
                '    ADD CONSTRAINT chk_widgets_status CHECK ("status" IN (\'a\', \'b\'))',
                '`);',
            ].join('\n'),
            errors: [{
                messageId: 'rawNeedsDropFirst',
                data: { statement: 'ADD CONSTRAINT', pairKeyword: 'DROP CONSTRAINT IF EXISTS', name: 'chk_widgets_status' },
            }],
        },
        {
            // Dropping a *different* constraint does not make this one re-runnable.
            filename: IN_SCOPE,
            code: [
                'exports.up = (knex) => knex.raw(`',
                '    ALTER TABLE main.widgets DROP CONSTRAINT IF EXISTS chk_other;',
                '    ALTER TABLE main.widgets ADD CONSTRAINT chk_widgets_status CHECK (true);',
                '`);',
            ].join('\n'),
            errors: [{
                messageId: 'rawNeedsDropFirst',
                data: { statement: 'ADD CONSTRAINT', pairKeyword: 'DROP CONSTRAINT IF EXISTS', name: 'chk_widgets_status' },
            }],
        },
        {
            // Pairing is scoped to the migration function: the drop in `down` runs on rollback,
            // not before the add in `up`, so it cannot make `up` re-runnable.
            filename: IN_SCOPE,
            code: [
                'exports.up = async (knex) => {',
                '    await knex.raw(\'ALTER TABLE main.widgets ADD CONSTRAINT chk_widgets_status CHECK (true)\');',
                '};',
                'exports.down = async (knex) => {',
                '    await knex.raw(\'ALTER TABLE main.widgets DROP CONSTRAINT IF EXISTS chk_widgets_status\');',
                '};',
            ].join('\n'),
            errors: [{
                messageId: 'rawNeedsDropFirst',
                data: { statement: 'ADD CONSTRAINT', pairKeyword: 'DROP CONSTRAINT IF EXISTS', name: 'chk_widgets_status' },
            }],
        },
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw("CREATE TYPE main.widget_status AS ENUM (\'a\', \'b\')");',
            errors: [{ messageId: 'rawNeedsDropFirst', data: { statement: 'CREATE TYPE', pairKeyword: 'DROP TYPE IF EXISTS', name: 'widget_status' } }],
        },
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw("CREATE TRIGGER trg_touch BEFORE UPDATE ON main.widgets EXECUTE FUNCTION main.touch()");',
            errors: [{ messageId: 'rawNeedsDropFirst', data: { statement: 'CREATE TRIGGER', pairKeyword: 'DROP TRIGGER IF EXISTS', name: 'trg_touch' } }],
        },
        {
            filename: IN_SCOPE,
            code: 'exports.up = (knex) => knex.raw("CREATE FUNCTION main.touch() RETURNS trigger AS 1 LANGUAGE sql");',
            errors: [{
                messageId: 'rawNeedsOrReplace',
                data: { statement: 'CREATE FUNCTION', replacement: 'CREATE OR REPLACE FUNCTION' },
            }],
        },
        {
            // SQL hoisted into a constant and handed to `knex.raw` later is still raw SQL.
            filename: IN_SCOPE,
            code: [
                'const createIndexSql = `CREATE INDEX idx_a ON main.widgets (id)`;',
                'exports.up = (knex) => knex.raw(createIndexSql);',
            ].join('\n'),
            errors: [{ messageId: 'rawMissingGuard', data: { statement: 'CREATE INDEX', guard: 'IF NOT EXISTS' } }],
        },
        {
            // Raw SQL reached through a `.then()` chain is still raw SQL.
            filename: IN_SCOPE,
            code: [
                'exports.up = (knex) => knex.schema.withSchema("main")',
                '    .createTableIfNotExists("widgets", (t) => { t.uuid("id"); })',
                '    .then(() => knex.raw("CREATE INDEX idx_a ON main.widgets (id)"));',
            ].join('\n'),
            errors: [
                { messageId: 'deprecatedCreateTableIfNotExists' },
                { messageId: 'rawMissingGuard' },
            ],
        },

        // --- The cutoff -------------------------------------------------------------------
        {
            // Exactly at the cutoff is in scope — the cutoff is inclusive.
            filename: '/repo/therr-services/users-service/src/store/migrations/20260730000000_main.widgets.js',
            options: [{ since: '20260730000000' }],
            code: 'exports.down = (knex) => knex.schema.dropTable("widgets");',
            errors: [{ messageId: 'dropInReplacement' }],
        },
        {
            // An off-convention filename gets no exemption — otherwise dropping the timestamp
            // prefix would be a way around the gate.
            filename: '/repo/therr-services/users-service/src/store/migrations/add-widgets.js',
            options: [{ since: '20260730000000' }],
            code: 'exports.down = (knex) => knex.schema.dropTable("widgets");',
            errors: [{ messageId: 'dropInReplacement' }],
        },
    ],
});

// eslint-disable-next-line no-console
console.log('require-idempotent-migration: all cases passed');
