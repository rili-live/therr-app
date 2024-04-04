exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaceIncentiveCoupons', async (table) => {
    table.primary('spaceIncentiveId');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaceIncentiveCoupons', (table) => {
    table.dropPrimary();
});
