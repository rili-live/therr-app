// Forbid direct string references to brand-scoped tables.
//
// A brand-scoped table holds rows belonging to one brand (Therr, Habits, Teem). Reading it
// without a `brandVariation` predicate leaks another brand's rows into the current app —
// a correctness bug that is invisible in testing unless you happen to have a multi-brand
// user. The defence is that every read goes through a BrandScopedStore subclass, which
// injects the predicate. This rule makes bypassing that a lint error.
//
// It flags the table name as a *string literal*, which catches:
//   .from('main.notifications')          knex builder
//   .into('main.notifications')          knex insert
//   knex.raw('... FROM main.notifications ...')   raw SQL (substring match)
//   export const X = 'main.notifications'        re-exporting the constant
//
// Sanctioned store files are exempted via narrow per-file overrides in the service's
// .eslintrc.js — one file each, never a glob.
//
// See docs/NICHE_APP_DATABASE_GUIDELINES.md and eslint-config/brand-scoped-tables.js.

const { BRAND_SCOPED_TABLES } = require('../../brand-scoped-tables');

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow direct string references to brand-scoped database tables',
            recommended: true,
        },
        schema: [
            {
                type: 'object',
                properties: {
                    tables: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                },
                additionalProperties: false,
            },
        ],
        messages: {
            directReference:
                'Direct reference to brand-scoped table "{{table}}" is forbidden. '
                + 'Route the query through the BrandScopedStore subclass for this table. '
                + 'See docs/NICHE_APP_DATABASE_GUIDELINES.md.',
        },
    },

    create(context) {
        // Options exist so the rule can be unit-tested against a fixed table list rather
        // than whatever the real list happens to contain today.
        const configured = (context.options[0] || {}).tables;
        const tables = configured && configured.length ? configured : BRAND_SCOPED_TABLES;

        if (!tables.length) {
            // No tables onboarded yet (early in the multi-app data isolation rollout).
            return {};
        }

        const report = (node, table) => {
            context.report({ node, messageId: 'directReference', data: { table } });
        };

        return {
            Literal(node) {
                if (typeof node.value !== 'string') {
                    return;
                }

                // Exact match: the common case, a table name used as a knex argument or constant.
                const exact = tables.find((table) => node.value === table);
                if (exact) {
                    report(node, exact);
                    return;
                }

                // Substring match: raw SQL embeds the table name inside a longer query string.
                const embedded = tables.find((table) => node.value.includes(table));
                if (embedded) {
                    report(node, embedded);
                }
            },

            TemplateLiteral(node) {
                // Raw SQL is frequently a template literal. Only the static chunks can be
                // checked; an interpolated table name is out of reach for a lint rule.
                node.quasis.forEach((quasi) => {
                    const text = quasi.value.raw;
                    const match = tables.find((table) => text.includes(table));
                    if (match) {
                        report(quasi, match);
                    }
                });
            },
        };
    },
};
