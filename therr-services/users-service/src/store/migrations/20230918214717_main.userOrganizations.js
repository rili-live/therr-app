exports.up = (knex) => knex.schema.withSchema('main').alterTable('userOrganizations', (table) => {
    table.jsonb('accessLevels').defaultTo(JSON.stringify(['user.organizations.read'])).alter();
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('userOrganizations', (table) => {
    table.jsonb('accessLevels').defaultTo(JSON.stringify(['user.admin.read'])).alter();
});
