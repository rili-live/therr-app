exports.up = (knex) => knex.schema.withSchema('main').alterTable('momentStats', async (table) => {
    table.primary('momentId');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('momentStats', (table) => {
    table.dropPrimary();
});
