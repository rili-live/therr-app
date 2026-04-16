exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.boolean('autoRechargeEnabled').defaultTo(false);
    table.integer('autoRechargeThresholdCoins');
    table.string('autoRechargePackageId', 32);
    table.string('autoRechargeStripeCustomerId', 128);
    table.string('autoRechargePaymentMethodId', 128);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('autoRechargeEnabled');
    table.dropColumn('autoRechargeThresholdCoins');
    table.dropColumn('autoRechargePackageId');
    table.dropColumn('autoRechargeStripeCustomerId');
    table.dropColumn('autoRechargePaymentMethodId');
});
