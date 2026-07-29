const { RuleTester } = require('eslint');
const rule = require('../rules/no-async-table-builder-callback');

const ruleTester = new RuleTester({
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-async-table-builder-callback', rule, {
    valid: [
        // The correct shape: synchronous builder callback, awaits sequenced outside.
        'knex.schema.createTable("users", (table) => { table.string("id"); });',
        'knex.schema.alterTable("users", function (table) { table.string("id"); });',
        'knex.schema.withSchema("main").alterTable("users", (table) => { table.dropColumn("x"); });',

        // An async callback on a method that is not a table builder is none of this rule's business.
        'knex.transaction(async (trx) => { await trx.commit(); });',
        'items.forEach(async (item) => { await handle(item); });',

        // Bare call with no member expression.
        'createTable(async () => {});',
    ],

    invalid: [
        {
            code: 'knex.schema.createTable("users", async (table) => { table.string("id"); });',
            errors: [{ messageId: 'asyncCallback', data: { method: 'createTable' } }],
        },
        {
            code: 'knex.schema.alterTable("users", async function (table) { table.string("id"); });',
            errors: [{ messageId: 'asyncCallback', data: { method: 'alterTable' } }],
        },
        {
            // The exact defect that dropped main.moments.spaceId in migration 20230316132958:
            // table.* calls after an await never reach the emitted DDL.
            code: [
                'knex.schema.withSchema("main").alterTable("moments", async (table) => {',
                '    table.uuid("spaceId");',
                '    await somethingElse();',
                '    table.foreign("spaceId").references("main.spaces.id");',
                '});',
            ].join('\n'),
            errors: [{ messageId: 'asyncCallback', data: { method: 'alterTable' } }],
        },
        {
            code: 'knex.schema.createTableIfNotExists("t", async (table) => {});',
            errors: [{ messageId: 'asyncCallback' }],
        },
        {
            code: 'knex.schema.createTableLike("t", "u", async (table) => {});',
            errors: [{ messageId: 'asyncCallback' }],
        },
        {
            code: 'knex.table("users", async (table) => {});',
            errors: [{ messageId: 'asyncCallback', data: { method: 'table' } }],
        },
        {
            // Computed member access must not be an escape hatch.
            code: 'knex.schema["alterTable"]("users", async (table) => {});',
            errors: [{ messageId: 'asyncCallback', data: { method: 'alterTable' } }],
        },
    ],
});

console.log('no-async-table-builder-callback: all RuleTester cases passed');
