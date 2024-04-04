exports.up = (knex) => knex.schema.withSchema('main').alterTable('externalMediaIntegrations', async (table) => {
    table.primary('id');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('externalMediaIntegrations', (table) => {
    table.dropPrimary();
});
