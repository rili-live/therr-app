// Forbid `async` callbacks passed to Knex table builders.
//
// Knex invokes the createTable/alterTable callback *synchronously* while collecting the
// statement list, and discards whatever it returns. An `async` callback therefore splits
// the migration in two: everything before the first `await` is collected into the
// CREATE/ALTER TABLE, and everything after resumes as a floating promise nothing awaits.
//
// Both failure modes have already happened in this repo:
//   - Silent: `table.*` calls after an `await` are registered after Knex called toSQL(),
//     so they vanish from the emitted DDL with no error. This is how main.moments lost its
//     spaceId foreign key in migration 20230316132958.
//   - Loud: queries issued after the `await` land on an already-committed transaction and
//     throw "Transaction query already complete". Dormant while Knex wrapped the whole
//     batch in one transaction; detonates the moment any migration sets
//     `config.transaction = false` (Knex then uses a transaction per migration).
//
// A callback with no `await` is harmless today but one edit away from the above, so the
// rule bans the `async` keyword outright rather than trying to detect suspension points.
// Sequence the work in the migration body instead:
//
//   exports.up = async (knex) => {
//       await knex.schema.withSchema('main').alterTable('users', (table) => { ... });
//       await knex.schema.raw('...');
//   };

const TABLE_BUILDER_METHODS = [
    'createTable',
    'createTableIfNotExists',
    'createTableLike',
    'alterTable',
    'table',
];

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow async callbacks passed to Knex table builder methods',
            recommended: true,
        },
        schema: [
            {
                type: 'object',
                properties: {
                    methods: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                },
                additionalProperties: false,
            },
        ],
        messages: {
            asyncCallback:
                'Do not pass an `async` callback to Knex `{{method}}`. Knex calls it synchronously '
                + 'and ignores the returned promise, so `table.*` calls after an `await` are silently '
                + 'dropped from the DDL and queries after an `await` can outlive the migration '
                + 'transaction. Await each step in the migration body instead. '
                + 'See eslint-config/plugin/rules/no-async-table-builder-callback.js.',
        },
    },

    create(context) {
        const configured = (context.options[0] || {}).methods;
        const methods = configured && configured.length ? configured : TABLE_BUILDER_METHODS;

        const checkCall = (node) => {
            const { callee } = node;
            if (!callee || callee.type !== 'MemberExpression') {
                return;
            }

            // Handles both `.alterTable(...)` and `['alterTable'](...)`.
            const methodName = callee.property && (callee.property.name
                || (typeof callee.property.value === 'string' ? callee.property.value : null));

            if (!methodName || !methods.includes(methodName)) {
                return;
            }

            node.arguments.forEach((arg) => {
                const isFunction = arg.type === 'ArrowFunctionExpression'
                    || arg.type === 'FunctionExpression';
                if (isFunction && arg.async) {
                    context.report({
                        node: arg,
                        messageId: 'asyncCallback',
                        data: { method: methodName },
                    });
                }
            });
        };

        return { CallExpression: checkCall };
    },
};

module.exports.TABLE_BUILDER_METHODS = TABLE_BUILDER_METHODS;
