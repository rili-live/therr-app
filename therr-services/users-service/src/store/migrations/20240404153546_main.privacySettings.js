exports.up = (knex) => knex.schema.withSchema('main').alterTable('privacySettings', (table) => {
    table.primary('userId');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('privacySettings', (table) => {
    table.dropPrimary();
});
