// Per-day majority ledger for pacts — one row per (pact, day) on which a majority of the pact's
// active members completed the habit. This is the single source of truth behind two features:
//
//   1. The shared pact streak (habits.pacts.currentPactStreak): its length is the run of
//      consecutive credited days ending at habits.pacts.lastPactStreakDate. A row here is what
//      "the group made it that day" means.
//   2. Individual streak protection: when a member checks in after a gap, any missed day that
//      already has a row here (the group carried it) is forgiven rather than counted against
//      that member's personal `habits.streaks` row. The member was part of a pact that hit its
//      majority; the rules should not punish them for a day the group won.
//
// A row is written the moment a check-in pushes the completed count to the majority threshold,
// so the ledger fills in live rather than needing a nightly sweep. The UNIQUE (pactId,
// streakDate) makes that write idempotent: a later check-in the same day (or a retry) that
// re-evaluates the threshold cannot double-credit the day, and the shared-streak increment
// keys off the same "did the row already exist" answer.
//
// `activeMemberCount` / `completedCount` are frozen at credit time so the ledger stays truthful
// after members join or leave — the majority a day was won by is the membership that existed
// that day, not today's.
//
// habits schema (not a main.* brand-scoped table): brand isolation for habits is by schema, so
// no brandVariation predicate is required here — every row is reached through a pactId that is
// already scoped to the HABITS app.
//
// Idempotent per therr/require-idempotent-migration: a hasTable probe guards createTable (Knex
// warns against createTableIfNotExists), so a partially-applied run with no ledger row re-runs
// clean.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('habits').hasTable('pact_streak_days');
    if (exists) {
        return;
    }

    await knex.schema.withSchema('habits').createTable('pact_streak_days', (table) => {
        table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

        table.uuid('pactId').notNullable()
            .references('id').inTable('habits.pacts')
            .onUpdate('CASCADE')
            .onDelete('CASCADE');

        // The calendar day the majority was met, YYYY-MM-DD in the service's UTC habit day,
        // matching habit_checkins.scheduledDate so the two can be compared directly.
        table.date('streakDate').notNullable();

        // Frozen at credit time — the membership the day was won by, not today's.
        table.integer('activeMemberCount').notNullable();
        table.integer('completedCount').notNullable();

        table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

        // One credit per pact per day. Load-bearing: the shared-streak increment is gated on
        // this insert being the first for the day, and the protection lookup counts distinct days.
        table.unique(['pactId', 'streakDate']);

        // Both reads are "this pact's credited days in a date range" — covered by the unique
        // index's leading pactId, but an explicit composite keeps the range scan tight.
        table.index(['pactId', 'streakDate']);
    });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = (knex) => knex.schema.withSchema('habits').dropTableIfExists('pact_streak_days');
