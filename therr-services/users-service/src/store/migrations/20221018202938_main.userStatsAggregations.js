exports.up = (knex) => knex.schema.withSchema('main').alterTable('userStatsAggregations', (table) => {
    table.timestamp('latestMarketingEmailDate', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('latestMarketingPushNotificationDate', { useTz: true }).notNullable().defaultTo(knex.fn.now());
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('userStatsAggregations', (table) => {
    table.dropColumn('latestMarketingEmailDate');
    table.dropColumn('latestMarketingPushNotificationDate');
});
