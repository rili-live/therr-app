exports.up = (knex) => knex.schema.withSchema('main').alterTable('thoughtReactions', (table) => {
    table.primary('id');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('thoughtReactions', (table) => {
    table.dropPrimary();
});
