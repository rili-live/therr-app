exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.bool('shouldHideMatureContent').nullable().defaultsTo(true);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('shouldHideMatureContent');
});
