exports.up = (knex) => knex.schema.withSchema('main').alterTable('thoughtReactions', (table) => {
    table.index(['userId', 'userHasActivated', 'userHasReported']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('thoughtReactions', (table) => {
    table.dropIndex(['userId', 'userHasActivated', 'userHasReported']);
});
