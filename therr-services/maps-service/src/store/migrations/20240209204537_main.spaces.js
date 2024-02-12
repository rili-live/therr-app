exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.index(['latitude', 'longitude']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropIndex(['latitude', 'longitude']);
});
