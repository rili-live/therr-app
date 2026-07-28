// Sequenced explicitly rather than nested inside an async alterTable callback: knex invokes that
// callback synchronously and discards its promise, so the index raw below would escape the
// migration and could outlive its transaction. See eslint-config/migration-rules.js.
//
// The ordering also has to be explicit: the partial index reads "attendingCount", so the column
// must be committed to the DDL before the index is built.
exports.up = async (knex) => {
    await knex.schema.withSchema('main').alterTable('eventReactions', (table) => {
        table.integer('attendingCount');
        table.index(['userId', 'userHasActivated', 'userHasReported']);
    });

    await knex.schema.raw('CREATE INDEX idx_eventreactions_is_attending ON main."eventReactions" ("attendingCount") WHERE "attendingCount" IS NOT NULL;');
};

exports.down = (knex) => knex.schema.withSchema('main').alterTable('eventReactions', (table) => {
    table.dropColumn('attendingCount');
    table.dropIndex(['userId', 'userHasActivated', 'userHasReported']);
    table.dropIndex([], 'idx_eventreactions_is_attending');
});
