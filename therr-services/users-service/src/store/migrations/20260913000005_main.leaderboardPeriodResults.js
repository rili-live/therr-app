/**
 * Create main.leaderboardPeriodResults — final placements for a closed weekly leaderboard
 * period, written once per (brand, period, user) when the period closes.
 *
 * Archetype: Brand-scoped (per docs/NICHE_APP_DATABASE_GUIDELINES.md), like the
 * main.userLeaderboardScores it summarises: a period result belongs to exactly one brand's
 * board. Listed in eslint-config/brand-scoped-tables.js and read only through
 * LeaderboardPeriodResultsStore.
 *
 * Period model: there is no periods table — a period *is* its Monday-anchored UTC
 * `periodStart` (see utilities/leaderboardHelpers.ts getLeaderboardPeriodStart), so that is the
 * period id here and in the API (`POST /users/leaderboards/periods/:periodStart/acknowledge`).
 *
 *   placement    — standard competition rank (ties share: 1, 1, 3), 1..participants
 *   score        — the user's points for the period, frozen at close
 *   participants — how many eligible users had a score row that period, frozen at close
 *   leagueFrom / leagueTo — reserved for leagues (promotion/demotion). Always NULL today; the
 *                  client renders nothing for them. Kept so the seam exists without a schema
 *                  change later.
 *   acknowledgedAt — set when the placement screen / inline card is dismissed. The daily-streak
 *                  summary surfaces only unacknowledged results, capped to the 3 most recent
 *                  periods (older ones are auto-acknowledged), so a returning user never faces a
 *                  wall of modals.
 *
 * Idempotency of the close job rides the UNIQUE (brandVariation, periodStart, userId): the close
 * is an INSERT ... ON CONFLICT DO NOTHING, so a re-run, a lazy close from a client read, and the
 * scheduled close all converge on the same rows.
 *
 * Index: the hot read is "this user's unacknowledged results, newest first" —
 * (brandVariation, userId, periodStart DESC) partial on acknowledgedAt IS NULL.
 *
 * Idempotent per therr/require-idempotent-migration (hasTable probe, CREATE INDEX IF NOT EXISTS).
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('main').hasTable('leaderboardPeriodResults');
    if (!exists) {
        await knex.schema.withSchema('main').createTable('leaderboardPeriodResults', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
            table.uuid('userId').notNullable()
                .references('id')
                .inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.string('brandVariation', 50).notNullable().defaultTo('therr');
            table.date('periodStart').notNullable();
            table.integer('placement').notNullable();
            table.integer('score').notNullable().defaultTo(0);
            table.integer('participants').notNullable().defaultTo(0);
            table.string('leagueFrom', 50);
            table.string('leagueTo', 50);
            table.timestamp('acknowledgedAt', { useTz: true });
            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.unique(['brandVariation', 'periodStart', 'userId']);
        });
    }

    await knex.raw(`
        CREATE INDEX IF NOT EXISTS "idx_leaderboardPeriodResults_brand_user_pending"
        ON main."leaderboardPeriodResults" ("brandVariation", "userId", "periodStart" DESC)
        WHERE "acknowledgedAt" IS NULL
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main."idx_leaderboardPeriodResults_brand_user_pending"');
    await knex.schema.withSchema('main').dropTableIfExists('leaderboardPeriodResults');
};
