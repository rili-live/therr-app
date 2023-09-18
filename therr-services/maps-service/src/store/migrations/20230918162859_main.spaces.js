exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.uuid('organizationId');
    table.index('organizationId');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('organizationId');
});
