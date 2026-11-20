// Create main.userLeaderboardLeagues — the leaderboard tier ("league") each user is in, per brand.
//
// Archetype: Brand-scoped (docs/NICHE_APP_DATABASE_GUIDELINES.md), like the
// main.userLeaderboardScores and main.leaderboardPeriodResults it sits between: a user's tier on
// the Friends with Habits board says nothing about their tier on the Therr board. Listed in
// eslint-config/brand-scoped-tables.js and read only through UserLeaderboardLeaguesStore.
//
// WHAT A ROW MEANS
//
// `league` is a tier id from therr-js-utilities/config `LEADERBOARD_TIERS_BY_BRAND` (e.g.
// 'seedling' for Habits, 'wanderer' for Therr). A user with no row is in their brand's lowest
// tier — so nobody needs a row to be placed, and nobody is demoted on the day leagues start:
// everyone begins at the bottom, where there is nothing to fall from.
//
// WHO WRITES IT
//
// Only the weekly close (handlers/helpers/leaderboardPeriods.ts), and only from what the close
// has already frozen into main.leaderboardPeriodResults.leagueTo — never from a value it computed
// in memory. Results rows are first-writer-wins (INSERT ... ON CONFLICT DO NOTHING), so applying
// moves from them means a scheduled close racing a lazy one, or a re-run after a crash between
// the two writes, converges on one answer instead of promoting someone twice.
//
//   lastPeriodStart — the period whose close last set `league`. The apply step only moves a row
//                     forward in time (`lastPeriodStart < excluded.lastPeriodStart`), so
//                     re-applying an old period is a no-op.
//
// Not read by either Cloud Function automator.
//
// Indexes, declared inside createTable so they exist the moment the table does:
//   - UNIQUE (brandVariation, userId) — one tier per user per brand; the conflict target of the
//     apply upsert and the join key every league-scoped board read uses.
//   - (brandVariation, league) — "everyone in this league", for the league-scoped push reads.
//
// Idempotent per therr/require-idempotent-migration: a hasTable probe guards createTable.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('main').hasTable('userLeaderboardLeagues');
    if (!exists) {
        await knex.schema.withSchema('main').createTable('userLeaderboardLeagues', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
            table.uuid('userId').notNullable()
                .references('id')
                .inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.string('brandVariation', 50).notNullable().defaultTo('therr');
            table.string('league', 50).notNullable();
            table.date('lastPeriodStart');
            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.unique(['brandVariation', 'userId']);
            table.index(['brandVariation', 'league'], 'idx_userLeaderboardLeagues_brand_league');
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.schema.withSchema('main').dropTableIfExists('userLeaderboardLeagues');
};
