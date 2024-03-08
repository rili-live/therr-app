exports.up = (knex) => knex.schema.withSchema('main').alterTable('momentReactions', async (table) => {
    table.index(['userId', 'userHasActivated', 'userHasReported']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('momentReactions', (table) => {
    table.dropIndex(['userId', 'userHasActivated', 'userHasReported']);
});
