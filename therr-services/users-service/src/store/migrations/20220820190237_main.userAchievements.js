exports.up = (knex) => knex.schema.withSchema('main').alterTable('userAchievements', (table) => {
    table.decimal('unclaimedRewardPts').notNullable().defaultTo(0);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('userAchievements', (table) => {
    table.dropColumn('unclaimedRewardPts');
});
