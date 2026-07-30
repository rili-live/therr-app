exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.index('createdAt');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropIndex('createdAt');
});
