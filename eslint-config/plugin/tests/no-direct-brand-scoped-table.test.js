const { RuleTester } = require('eslint');
const rule = require('../rules/no-direct-brand-scoped-table');

const ruleTester = new RuleTester({
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

// A fixed list so these cases do not change meaning when the real
// BRAND_SCOPED_TABLES list grows.
const options = [{ tables: ['main.notifications', 'main.userAchievements'] }];

ruleTester.run('no-direct-brand-scoped-table', rule, {
    valid: [
        // Tables not on the list are unaffected.
        { code: "knex.select().from('main.users');", options },
        { code: "knex.select().from('main.spaces');", options },

        // A near-miss must not trigger: enforcement keys off the full qualified name.
        { code: "knex.select().from('main.notification');", options },
        { code: "knex.select().from('habits.notifications');", options },

        // Non-string literals are irrelevant.
        { code: 'const limit = 100;', options },
        { code: 'const enabled = true;', options },

        // Interpolated table names are out of reach for a lint rule; documented as a
        // known limitation rather than a silent gap. The interpolation is the point of
        // this case, hence the disable.
        // eslint-disable-next-line no-template-curly-in-string
        { code: 'knex.raw(`SELECT * FROM ${tableName}`);', options },
    ],

    invalid: [
        {
            // The canonical violation: a knex builder pointed straight at the table.
            code: "knex.select().from('main.notifications');",
            options,
            errors: [{ messageId: 'directReference', data: { table: 'main.notifications' } }],
        },
        {
            code: "knex.insert(row).into('main.userAchievements');",
            options,
            errors: [{ messageId: 'directReference' }],
        },
        {
            // Re-exporting the constant is how enforcement gets laundered around the repo.
            code: "export const NOTIFICATIONS_TABLE_NAME = 'main.notifications';",
            options,
            errors: [{ messageId: 'directReference' }],
        },
        {
            // Raw SQL embeds the name inside a longer string.
            code: "knex.raw('SELECT COUNT(*) FROM main.notifications WHERE \"userId\" = ?', [id]);",
            options,
            errors: [{ messageId: 'directReference' }],
        },
        {
            // Static chunks of a template literal are checked.
            code: 'knex.raw(`SELECT * FROM main.notifications WHERE "isUnread" = true`);',
            options,
            errors: [{ messageId: 'directReference' }],
        },
        {
            // Two distinct tables in one file report separately.
            code: "const a = 'main.notifications'; const b = 'main.userAchievements';",
            options,
            errors: [
                { messageId: 'directReference', data: { table: 'main.notifications' } },
                { messageId: 'directReference', data: { table: 'main.userAchievements' } },
            ],
        },
        {
            // THE REGRESSION THIS RULE EXISTS TO PREVENT.
            //
            // Previously both this invariant and airbnb's for..of restriction lived under the
            // single `no-restricted-syntax` rule ID, so the disable comment below — written to
            // permit the loop — also switched off brand-scoped enforcement on the next line.
            // With a dedicated rule ID it cannot: the disable targets a different rule, so the
            // table reference must still be reported.
            code: [
                '// eslint-disable-next-line no-restricted-syntax',
                "for (const row of knex.select().from('main.notifications')) { use(row); }",
            ].join('\n'),
            options,
            errors: [{ messageId: 'directReference', data: { table: 'main.notifications' } }],
        },
    ],
});

console.log('no-direct-brand-scoped-table: all RuleTester cases passed');
