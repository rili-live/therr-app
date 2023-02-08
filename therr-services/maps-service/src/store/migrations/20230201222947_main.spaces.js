exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.string('featuredIncentiveKey'); // These are duplicated properties from the spaceIncentiveDetails table
    table.double('featuredIncentiveValue'); // These are duplicated properties from the spaceIncentiveDetails table
    table.string('featuredIncentiveRewardKey'); // These are duplicated properties from the spaceIncentiveDetails table
    table.double('featuredIncentiveRewardValue'); // These are duplicated properties from the spaceIncentiveDetails table
    table.string('featuredIncentiveCurrencyId'); // These are duplicated properties from the spaceIncentiveDetails table
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('featuredIncentiveKey');
    table.dropColumn('featuredIncentiveValue');
    table.dropColumn('featuredIncentiveRewardKey');
    table.dropColumn('featuredIncentiveRewardValue');
    table.dropColumn('featuredIncentiveCurrencyId');
});
