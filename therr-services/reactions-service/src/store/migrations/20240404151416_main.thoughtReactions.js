exports.up = (knex) => knex.schema.withSchema('main').alterTable('thoughtReactions', async (table) => {
    table.primary('id');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('thoughtReactions', (table) => {
    table.dropPrimary();
});
