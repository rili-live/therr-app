exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.uuid('requestedByUserId').nullable();
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('requestedByUserId');
});
