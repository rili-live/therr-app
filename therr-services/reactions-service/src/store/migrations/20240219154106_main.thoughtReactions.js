exports.up = (knex) => knex.schema.withSchema('main').alterTable('thoughtReactions', async (table) => {
    table.index('createdAt');
    table.index(['thoughtId', 'userHasLiked']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('thoughtReactions', (table) => {
    table.dropIndex('createdAt');
    table.dropIndex(['thoughtId', 'userHasLiked']);
});
