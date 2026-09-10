/**
 * Add settingsIsLeaderboardEnabled to main.users — leaderboard participation opt-out.
 *
 * Defaults to true (default-in): boards stay lively and the setting only needs to be
 * consulted at ranking-read time. Users who disable it keep earning XP privately (their
 * userLeaderboardScores rows still accumulate) but are excluded from every leaderboard
 * response, so re-enabling restores their standing instantly.
 *
 * @param { import("knex").Knex } knex
 */
exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.boolean('settingsIsLeaderboardEnabled').notNullable().defaultTo(true);
});

/**
 * @param { import("knex").Knex } knex
 */
exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('settingsIsLeaderboardEnabled');
});
