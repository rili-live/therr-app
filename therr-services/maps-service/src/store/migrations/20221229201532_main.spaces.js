exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.index('createdAt');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropIndex('createdAt');
});
