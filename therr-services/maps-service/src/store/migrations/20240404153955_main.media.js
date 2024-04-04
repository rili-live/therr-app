exports.up = (knex) => knex.schema.withSchema('main').alterTable('media', async (table) => {
    table.primary('id');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('media', (table) => {
    table.dropPrimary();
});
