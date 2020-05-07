exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.index('userName').index('email');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropIndex('userName').dropIndex('email');
});
