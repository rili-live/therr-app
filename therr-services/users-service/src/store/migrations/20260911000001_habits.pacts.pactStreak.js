// Shared ("pact") streak — the group's own streak, distinct from each member's personal
// `habits.streaks` row.
//
// Until now a "pact streak" was a fiction: `habits.streaks` is keyed (userId, habitGoalId)
// and every member had their own, so a five-person pact had five unrelated streaks and one
// member slipping broke only their own. Product wants the group to have a single streak that
// advances on any day a *majority* of active members check in — so a couple of people missing
// no longer costs the group its momentum — and members who missed such a day should not have
// their personal streak reset for it (the day was carried by the group). The per-day majority
// ledger that powers both lives in `habits.pact_streak_days` (next migration); these columns
// hold the derived running total so a list read does not have to walk that ledger.
//
//   - currentPactStreak / longestPactStreak: the group's running and best streak lengths.
//   - lastPactStreakDate: the last calendar day the majority threshold was met and credited.
//     A DATE, matching `habit_checkins.scheduledDate` (YYYY-MM-DD, the service's UTC habit day),
//     so the continuity check compares like with like.
//   - isSolo: set when the last remaining active member opts to continue the pact alone rather
//     than let it wind down. The pact stays `active` with one member; without this flag a
//     one-member pact is indistinguishable from a group whose partners have not accepted yet.
//
// Idempotent (ADD COLUMN IF NOT EXISTS) per therr/require-idempotent-migration: knex writes the
// knex_migrations row only after the function resolves, so a run killed partway would otherwise
// leave some columns in place with no ledger row and fail from the top on the next deploy.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw(
        'ALTER TABLE habits."pacts" ADD COLUMN IF NOT EXISTS "currentPactStreak" integer NOT NULL DEFAULT 0',
    );
    await knex.raw(
        'ALTER TABLE habits."pacts" ADD COLUMN IF NOT EXISTS "longestPactStreak" integer NOT NULL DEFAULT 0',
    );
    await knex.raw('ALTER TABLE habits."pacts" ADD COLUMN IF NOT EXISTS "lastPactStreakDate" date');
    await knex.raw(
        'ALTER TABLE habits."pacts" ADD COLUMN IF NOT EXISTS "isSolo" boolean NOT NULL DEFAULT false',
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('ALTER TABLE habits."pacts" DROP COLUMN IF EXISTS "isSolo"');
    await knex.raw('ALTER TABLE habits."pacts" DROP COLUMN IF EXISTS "lastPactStreakDate"');
    await knex.raw('ALTER TABLE habits."pacts" DROP COLUMN IF EXISTS "longestPactStreak"');
    await knex.raw('ALTER TABLE habits."pacts" DROP COLUMN IF EXISTS "currentPactStreak"');
};
