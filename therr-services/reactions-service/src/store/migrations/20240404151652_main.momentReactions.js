exports.up = (knex) => knex.schema.withSchema('main').alterTable('momentReactions', (table) => {
    table.primary('id');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('momentReactions', (table) => {
    table.dropPrimary();
});
