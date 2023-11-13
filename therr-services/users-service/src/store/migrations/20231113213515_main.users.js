exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.string('billingEmail');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('billingEmail');
});
