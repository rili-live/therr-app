exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.text('integrationsAccess').defaultsTo(JSON.stringify({}));
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('integrationsAccess');
});
