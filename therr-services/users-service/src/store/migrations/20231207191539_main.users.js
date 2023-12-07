exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.boolean('settingsEmailBusMarketing').nullable().defaultsTo(false);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('settingsEmailBusMarketing');
});
