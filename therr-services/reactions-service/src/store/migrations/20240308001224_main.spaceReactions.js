exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaceReactions', async (table) => {
    table.index(['userId', 'userHasActivated', 'userHasReported']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaceReactions', (table) => {
    table.dropIndex(['userId', 'userHasActivated', 'userHasReported']);
});
