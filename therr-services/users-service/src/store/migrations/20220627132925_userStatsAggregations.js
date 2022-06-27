/**
 * This table is used to track a user's content preferences as well as total activities.
 * It will be updated on a regular cadence by a scheduled, recurring process.
 * It can be used by machine learning models to gather inputs when predicting what content to prioritize
 * or when to send marketing emails.
 * It can also be used for user achievement/ranking/stats/etc.
 */

exports.up = (knex) => knex.schema.withSchema('main').createTable('userStatsAggregations', (table) => {
    table.uuid('userId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');

    // Email/Notification Marketing
    table.string('latestMarketingEmail'); // engagement marketing emails
    table.string('latestMarketingNotification'); // in-app notification
    table.string('latestMarketingPushNotification'); // engagement marketing push notifications
    table.integer('totalMarketingPushNotificationsReceived').notNullable().defaultTo(0); // track received vs. opened push notifications
    table.integer('totalMarketingPushNotificationsClicked').notNullable().defaultTo(0); // track received vs. opened push notifications
    table.integer('totalStandardPushNotificationsReceived').notNullable().defaultTo(0); // track received vs. opened push notifications
    table.integer('totalStandardPushNotificationsClicked').notNullable().defaultTo(0); // track received vs. opened push notifications

    // Activity Statistics
    table.integer('totalContentArtReactions').notNullable().defaultTo(0);
    table.integer('totalContentDealReactions').notNullable().defaultTo(0);
    table.integer('totalContentFoodReactions').notNullable().defaultTo(0);
    table.integer('totalContentIdeaReactions').notNullable().defaultTo(0);
    table.integer('totalContentMusicReactions').notNullable().defaultTo(0);
    table.integer('totalContentNatureReactions').notNullable().defaultTo(0);
    table.integer('totalContentStorefrontReactions').notNullable().defaultTo(0);
    table.integer('threeMonthTotalContentArtReactions').notNullable().defaultTo(0);
    table.integer('threeMonthTotalContentDealReactions').notNullable().defaultTo(0);
    table.integer('threeMonthTotalContentFoodReactions').notNullable().defaultTo(0);
    table.integer('threeMonthTotalContentIdeaReactions').notNullable().defaultTo(0);
    table.integer('threeMonthTotalContentMusicReactions').notNullable().defaultTo(0);
    table.integer('threeMonthTotalContentNatureReactions').notNullable().defaultTo(0);
    table.integer('threeMonthTotalContentStorefrontReactions').notNullable().defaultTo(0);
    table.integer('totalUserConnections').notNullable().defaultTo(0);

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index(['userId']);
});

exports.down = (knex) => knex.schema.dropTable('main.userStatsAggregations');
