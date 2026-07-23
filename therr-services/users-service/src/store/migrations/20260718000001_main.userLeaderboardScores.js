/**
 * Create main.userLeaderboardScores — weekly XP aggregates powering the leaderboard.
 *
 * Archetype: Brand-scoped (per docs/NICHE_APP_DATABASE_GUIDELINES.md). Each row is one
 * user's XP total for one brand for one weekly period. XP is a permanent, append-only
 * measure of activity — deliberately separate from users.settingsTherrCoinTotal, which
 * is a spendable currency (gift-card exchange decrements it). Ranking by coins would
 * punish users who redeem rewards; ranking by XP never regresses.
 *
 * Period model:
 *   - periodStart is the Monday (UTC) of the ISO week the XP was earned in.
 *   - Weekly board = single-row-per-user lookup on (brandVariation, periodStart).
 *   - All-time board = SUM(points) GROUP BY userId for the brand. At current scale this
 *     aggregates a few hundred rows per user per decade; materialize later if needed.
 *   - Future Duolingo-style leagues can layer on by adding a cohort table that
 *     references (userId, brandVariation, periodStart) — no changes needed here.
 *
 * Defaults:
 *   - brandVariation NOT NULL default 'therr' (canonical brand-scoped pattern; the table
 *     is new so there are no legacy rows, but the default keeps inserts safe if a caller
 *     ever misses the column).
 *
 * Index strategy:
 *   - Unique (userId, brandVariation, periodStart) backs the upsert-increment write path
 *     and the "my score this week" lookup.
 *   - (brandVariation, periodStart, points DESC) serves the hot read: top-N ranking for
 *     the current week within one brand. brandVariation leads because every leaderboard
 *     query filters by it and periodStart equality narrows to one week before the
 *     points-ordered scan.
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.schema.withSchema('main').createTable('userLeaderboardScores', (table) => {
        table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('userId').notNullable()
            .references('id')
            .inTable('main.users')
            .onUpdate('CASCADE')
            .onDelete('CASCADE');
        table.string('brandVariation', 50).notNullable().defaultTo('therr');
        table.date('periodStart').notNullable();
        table.integer('points').notNullable().defaultTo(0);

        // Audit
        table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

        table.unique(['userId', 'brandVariation', 'periodStart']);
    });
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_userLeaderboardScores_brand_period_points
        ON main."userLeaderboardScores" ("brandVariation", "periodStart", "points" DESC)
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main."idx_userLeaderboardScores_brand_period_points"');
    await knex.schema.withSchema('main').dropTable('userLeaderboardScores');
};
