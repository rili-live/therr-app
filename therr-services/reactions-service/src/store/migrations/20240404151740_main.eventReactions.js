exports.up = (knex) => knex.schema.withSchema('main').alterTable('eventReactions', async (table) => {
    table.primary('id');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('eventReactions', (table) => {
    table.dropPrimary();
});
