// Lint rules specific to Knex migration files (src/store/migrations/**).
//
// Guards against the defect class that broke CI in 20230815184654_main.users.js: passing an
// `async` callback to a Knex table builder.
//
// Knex invokes the createTable/alterTable callback *synchronously* while it collects the
// statement list, and discards whatever the callback returns. An `async` callback therefore
// splits the migration in two: everything before the first `await` is collected into the
// ALTER/CREATE TABLE, and everything after it resumes as a floating promise that nothing
// awaits — the migration's own promise resolves as soon as the table statement does.
//
// The consequences are both silent and loud:
//   - Silent: `table.*` calls placed after an `await` are registered after Knex already
//     called toSQL(), so they are dropped from the emitted DDL with no error. This is how
//     main.moments lost its spaceId foreign key in 20230316132958.
//   - Loud: queries issued after the `await` land on a transaction that has already
//     committed, which throws "Transaction query already complete". This stayed dormant for
//     years because Knex wrapped the whole batch in a single transaction; it detonates the
//     moment any one migration in the service sets `config.transaction = false` (Knex then
//     switches to a transaction per migration — see Migrator.latest()).
//
// A callback with no `await` in it is harmless today, but it is one edit away from the above,
// so the rule bans the `async` keyword outright rather than trying to detect suspension points.
// Sequence the work explicitly instead:
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

const MESSAGE = 'Do not pass an `async` callback to a Knex table builder. Knex calls it synchronously '
    + 'and ignores the returned promise, so `table.*` calls after an `await` are silently dropped from the '
    + 'DDL and queries after an `await` can outlive the migration\'s transaction. Await each step in the '
    + 'migration body instead. See eslint-config/migration-rules.js.';

const methodPattern = `/^(${TABLE_BUILDER_METHODS.join('|')})$/`;

const NO_ASYNC_TABLE_BUILDER_CALLBACK = [
    'ArrowFunctionExpression',
    'FunctionExpression',
].map((fnType) => ({
    selector: `CallExpression[callee.property.name=${methodPattern}] > ${fnType}[async=true]`,
    message: MESSAGE,
}));

module.exports = {
    TABLE_BUILDER_METHODS,
    NO_ASYNC_TABLE_BUILDER_CALLBACK,
};
