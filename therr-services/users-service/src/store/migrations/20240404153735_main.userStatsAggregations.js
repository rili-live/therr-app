exports.up = (knex) => knex.schema.withSchema('main').alterTable('userStatsAggregations', async (table) => {
    table.primary('userId');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('userStatsAggregations', (table) => {
    table.dropPrimary();
});
