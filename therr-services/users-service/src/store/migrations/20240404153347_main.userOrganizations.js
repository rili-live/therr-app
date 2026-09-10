exports.up = (knex) => knex.schema.withSchema('main').alterTable('userOrganizations', (table) => {
    table.primary(['organizationId', 'userId']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('userOrganizations', (table) => {
    table.dropPrimary();
});
