exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaceReactions', async (table) => {
    table.index('createdAt');
    table.index(['spaceId', 'userHasLiked']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaceReactions', (table) => {
    table.dropIndex('createdAt');
    table.dropIndex(['spaceId', 'userHasLiked']);
});
