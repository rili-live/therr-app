exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.bool('isBusinessAccount').nullable().defaultsTo(false);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('isBusinessAccount');
});
