exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.string('displayName').nullable();
    table.bool('isUnclaimed').nullable().defaultsTo(false);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('displayName');
    table.dropColumn('isUnclaimed');
});
