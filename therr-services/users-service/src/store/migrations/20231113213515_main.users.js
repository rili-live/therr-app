exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.string('billingEmail');

    table.index('billingEmail').index('phoneNumber');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('billingEmail');
});
