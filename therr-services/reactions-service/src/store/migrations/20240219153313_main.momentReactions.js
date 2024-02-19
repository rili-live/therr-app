exports.up = (knex) => knex.schema.withSchema('main').alterTable('momentReactions', async (table) => {
    table.index('createdAt');
    table.index(['momentId', 'userHasLiked']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('momentReactions', (table) => {
    table.dropIndex('createdAt');
    table.dropIndex(['momentId', 'userHasLiked']);
});
