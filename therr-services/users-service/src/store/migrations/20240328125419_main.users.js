exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.bool('isBot');
    table.string('botType');
    table.index('isBot');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('isBot');
    table.dropColumn('botType');
});
