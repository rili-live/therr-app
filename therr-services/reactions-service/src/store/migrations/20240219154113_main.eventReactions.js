exports.up = (knex) => knex.schema.withSchema('main').alterTable('eventReactions', async (table) => {
    table.index('createdAt');
    table.index(['eventId', 'userHasLiked']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('eventReactions', (table) => {
    table.dropIndex('createdAt');
    table.dropIndex(['eventId', 'userHasLiked']);
});
