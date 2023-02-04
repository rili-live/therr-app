exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.string('incentiveRequirement');
    table.double('incentiveRequirementValue');
    table.string('incentiveRewardType');
    table.double('incentiveRewardAmount');
    table.string('incentiveCurrency');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('incentiveAction');
    table.dropColumn('incentiveRequirementType');
    table.dropColumn('incentiveRewardType');
    table.dropColumn('incentiveRewardAmount');
    table.dropColumn('incentiveCurrency');
});
