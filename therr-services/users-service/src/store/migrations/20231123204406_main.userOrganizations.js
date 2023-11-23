exports.up = (knex) => knex.schema.withSchema('main').alterTable('userOrganizations', (table) => {
    table.uuid('organizationId').notNullable().alter();
    table.uuid('userId').notNullable().alter();
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('userOrganizations', (table) => {
    table.uuid('organizationId').nullable().alter();
    table.uuid('userId').nullable().alter();
});
