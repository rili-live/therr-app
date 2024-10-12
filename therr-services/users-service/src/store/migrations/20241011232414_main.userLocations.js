/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = (knex) => knex.schema.withSchema('main').alterTable('userLocations', (table) => {
    table.timestamp('lastPushNotificationSent', { useTz: true });
    table.index(['userId', 'lastPushNotificationSent']);
});

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = (knex) => knex.schema.withSchema('main').alterTable('userLocations', (table) => {
    table.dropColumn('lastPushNotificationSent');
});
