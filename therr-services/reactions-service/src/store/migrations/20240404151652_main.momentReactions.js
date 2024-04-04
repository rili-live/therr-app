exports.up = (knex) => knex.schema.withSchema('main').alterTable('momentReactions', async (table) => {
    table.primary('id');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('momentReactions', (table) => {
    table.dropPrimary();
});
