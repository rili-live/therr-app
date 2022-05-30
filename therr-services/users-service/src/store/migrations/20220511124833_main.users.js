exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.boolean('settingsIsProfilePublic').defaultTo(true);
    table.boolean('settingsIsAccountSoftDeleted').defaultTo(false);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('settingsIsProfilePublic');
    table.dropColumn('settingsIsAccountSoftDeleted');
});
