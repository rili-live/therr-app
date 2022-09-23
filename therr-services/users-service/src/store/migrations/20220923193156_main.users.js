exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.string('settingsLocale').defaultTo('en-us').alter();
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.decimal('settingsLocale').defaultTo(0).alter();
});
