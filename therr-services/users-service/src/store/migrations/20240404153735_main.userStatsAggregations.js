exports.up = (knex) => knex.schema.withSchema('main').alterTable('userStatsAggregations', (table) => {
    table.primary('userId');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('userStatsAggregations', (table) => {
    table.dropPrimary();
});
