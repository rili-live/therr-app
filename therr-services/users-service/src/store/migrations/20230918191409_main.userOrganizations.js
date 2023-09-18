exports.up = (knex) => knex.schema.withSchema('main').alterTable('userOrganizations', (table) => {
    table.jsonb('accessLevels').defaultTo(JSON.stringify(['user.admin.read']));
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('userOrganizations', (table) => {
    table.dropColumn('accessLevels');
});
