exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.jsonb('happyHours');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('happyHours');
});
