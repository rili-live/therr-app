exports.up = (knex) => knex.schema.withSchema('main').alterTable('eventReactions', async (table) => {
    table.integer('attendingCount');
    table.index(['userId', 'userHasActivated', 'userHasReported']);
    await knex.schema.raw('CREATE INDEX idx_eventreactions_is_attending ON main."eventReactions" ("attendingCount") WHERE "attendingCount" IS NOT NULL;');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('eventReactions', async (table) => {
    table.dropIndex(['userId', 'userHasActivated', 'userHasReported']);
    table.dropIndex([], 'idx_eventreactions_is_attending');
});
