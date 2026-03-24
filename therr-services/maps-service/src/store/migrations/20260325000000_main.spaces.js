exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.string('businessEmail').nullable();
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('businessEmail');
});
