exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.bool('isCreatorAccount').nullable().defaultsTo(false);
    table.bool('isSuperUser').nullable().defaultsTo(false); // Gets a badge next to username
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('isCreatorAccount');
    table.dropColumn('isSuperUser');
});
