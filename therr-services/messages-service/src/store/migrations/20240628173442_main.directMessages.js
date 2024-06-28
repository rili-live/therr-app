exports.up = (knex) => knex.schema.withSchema('main').alterTable('directMessages', (table) => {
    table.index('updatedAt');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('directMessages', (table) => {
    table.dropIndex('updatedAt');
});
