exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.index('createdAt').index('updatedAt');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropIndex('createdAt').dropIndex('updatedAt');
});
