const path = require('path');
const { RuleTester } = require('eslint');
const rule = require('../rules/no-unquoted-camelcase-table-in-raw-sql');

const ruleTester = new RuleTester({
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

// Import resolution reads the imported module off disk relative to the linted file, so
// cases that import from './tableNames' are given a filename inside tests/fixtures.
const fixtureFile = path.join(__dirname, 'fixtures', 'AStore.ts');

/* eslint-disable no-template-curly-in-string -- the interpolations are the subject of these cases */
ruleTester.run('no-unquoted-camelcase-table-in-raw-sql', rule, {
    valid: [
        // Lowercase and snake_case names are unaffected by identifier folding.
        { code: 'knex.raw(`SELECT 1 FROM habits.pacts p`);' },
        { code: "knex.raw('DELETE FROM main.users WHERE \"id\" = ?', [id]);" },

        // Quoted camelCase is the correct form.
        { code: 'knex.raw(`INSERT INTO main."leaderboardPeriodResults" ("userId") VALUES (?)`, [id]);' },
        { code: "knex.raw('SELECT * FROM main.\"userLocations\" WHERE \"userId\" = ?', [id]);" },

        // An interpolation that resolves, in this file, to a lowercase name.
        { code: "const T = 'habits.habit_checkins'; knex.raw(`SELECT COUNT(*) FROM ${T} c`);" },
        { code: "const T = 'main.thoughts'; knex.raw(`(SELECT COUNT(*) FROM ${T} AS c WHERE c.\"parentId\" = ${T}.id) AS \"replyCount\"`);" },
        { code: "const T = 'main.thoughts'; query.andWhereRaw(`${T}.\"createdAt\" <= NOW()`);" },
        // …through a local const alias of a const.
        { code: "const A = 'habits.pacts'; const B = A; knex.raw(`FROM ${B} p`);" },

        // An interpolation that resolves one hop into a relative import.
        {
            code: "import { PACTS_TABLE_NAME } from './tableNames'; knex.raw(`SELECT 1 FROM ${PACTS_TABLE_NAME} p`);",
            filename: fixtureFile,
        },
        {
            code: "import { TYPED_TABLE_NAME } from './tableNames'; knex.raw(`SELECT 1 FROM ${TYPED_TABLE_NAME} u`);",
            filename: fixtureFile,
        },

        // The quoting helper is always accepted, whatever it wraps.
        { code: 'knex.raw(`INSERT INTO ${quoteTableName(this.tableName)} ("userId") VALUES (?)`, [id]);' },
        { code: "import { quoteTableName } from 'therr-js-utilities/db'; knex.raw(`FROM ${quoteTableName(USER_LOCATIONS_TABLE_NAME)} l`);" },
        { code: 'knex.raw(`UPDATE ${sql.quoteTableName(table)} SET "x" = 1`);' },
        // …including through a local const, which is how a multi-line query reads best.
        { code: 'const results = quoteTableName(this.tableName); knex.raw(`INSERT INTO ${results} ("userId") VALUES (?)`, [id]);' },
        { code: 'knex.raw(`FROM ${quoteIdent(this.tableName)} t`);', options: [{ quoteHelpers: ['quoteIdent'] }] },

        // Keywords are uppercase SQL only: prose that happens to say "from ${x}" is not SQL.
        { code: 'const body = `${user} requested ${amount} coins from ${provider}.`;' },
        { code: 'const message = `Loaded ${count} rows for ${name}.`;' },
        { code: 'logger.info(`Update ${name} finished`);' },

        // A sentence ending on an interpolation is not a column qualifier.
        { code: 'const text = `Results for ${name}. See below`;' },

        // The builder quotes for itself; a dotted table.column string is not raw SQL.
        { code: "query.select('main.userConnections.id').from('main.userConnections');" },

        // Non-SQL keyword-shaped text with no dotted name is ignored.
        { code: "const sql = 'SELECT NOW() FROM generate_series(1, 10)';" },
        { code: 'knex.raw(`SELECT EXTRACT(EPOCH FROM NOW())`);' },
    ],

    invalid: [
        {
            // THE PRODUCTION FAILURE: a camelCase table interpolated bare via `this.tableName`,
            // which nothing can resolve. Postgres folded it and the INSERT never once succeeded.
            code: 'knex.raw(`INSERT INTO ${this.tableName} ("userId", "brandVariation") SELECT ranked."userId", ?::text FROM ranked`, [brand]);',
            errors: [{ messageId: 'unresolvableTable' }],
        },
        {
            // …and its companion in the same query: an imported constant the rule cannot read
            // (a bare module specifier), aliased locally. Unknown means report.
            code: "import { X } from 'somewhere'; const scoresTable = X; knex.raw(`FROM ${scoresTable} s`);",
            errors: [{ messageId: 'unresolvableTable' }],
        },
        {
            // A bare camelCase name written directly into raw SQL.
            code: 'knex.raw(`SELECT 1 FROM main.leaderboardPeriodResults r`);',
            errors: [{
                messageId: 'bareCamelCase',
                data: { table: 'main.leaderboardPeriodResults', folded: 'main.leaderboardperiodresults', quoted: 'main."leaderboardPeriodResults"' },
            }],
        },
        {
            code: "knex.raw('UPDATE main.userLocations SET \"visitCount\" = \"visitCount\" + 1');",
            errors: [{ messageId: 'bareCamelCase' }],
        },
        {
            // A local const that resolves to a camelCase name, interpolated bare.
            code: "const T = 'main.userAchievements'; knex.raw(`DELETE FROM ${T} WHERE \"userId\" = ?`, [id]);",
            errors: [{ messageId: 'bareCamelCase' }],
        },
        {
            // An import that resolves to a camelCase name, interpolated bare.
            code: "import { USER_LOCATIONS_TABLE_NAME } from './tableNames'; knex.raw(`SELECT 1 FROM ${USER_LOCATIONS_TABLE_NAME} l`);",
            filename: fixtureFile,
            errors: [{ messageId: 'bareCamelCase' }],
        },
        {
            // Every table-position keyword is covered.
            code: [
                "const T = 'main.userLocations';",
                'knex.raw(`INSERT INTO ${T} ("id") VALUES (1)`);',
                'knex.raw(`UPDATE ${T} SET "x" = 1`);',
                'knex.raw(`SELECT 1 FROM main.users u INNER JOIN ${T} l ON l."userId" = u."id"`);',
                'knex.raw(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS "y" INTEGER`);',
            ].join('\n'),
            errors: [
                { messageId: 'bareCamelCase' },
                { messageId: 'bareCamelCase' },
                { messageId: 'bareCamelCase' },
                { messageId: 'bareCamelCase' },
            ],
        },
        {
            // Used as a column qualifier inside SQL.
            code: "const T = 'main.userLocations'; query.whereRaw(`${T}.\"createdAt\" <= NOW() AND ${T}.id IS NOT NULL`);",
            errors: [{ messageId: 'bareCamelCase' }, { messageId: 'bareCamelCase' }],
        },
        {
            // A function parameter cannot be resolved: wrap it.
            code: 'tables.map((tableName) => knex.raw(`SELECT DISTINCT elem->>\'path\' FROM ${tableName} c`));',
            errors: [{ messageId: 'unresolvableTable' }],
        },
        {
            // A `let` may be reassigned, so it does not count as resolved.
            code: "let T = 'habits.pacts'; knex.raw(`FROM ${T} p`);",
            errors: [{ messageId: 'unresolvableTable' }],
        },
        {
            // String concatenation is raw SQL too.
            code: "const T = 'main.userLocations'; knex.raw('SELECT 1 FROM ' + T + ' WHERE \"id\" = ?', [id]);",
            errors: [{ messageId: 'bareCamelCase' }],
        },
        {
            code: "knex.raw('SELECT 1 FROM ' + this.tableName);",
            errors: [{ messageId: 'unresolvableTable' }],
        },
    ],
});
/* eslint-enable no-template-curly-in-string */

console.log('no-unquoted-camelcase-table-in-raw-sql: all RuleTester cases passed');
