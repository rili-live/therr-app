exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaceReactions', (table) => {
    table.primary('id');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaceReactions', (table) => {
    table.dropPrimary();
});
