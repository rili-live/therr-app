// The user's own calendar day for a check-in, for the app-level daily streak.
//
// `scheduledDate` is the habit day as the service counts it — UTC, set by the client from
// `new Date().toISOString()` (see the note on submitCheckin in the mobile Dashboard). That is
// fine for per-habit streaks, which only care that consecutive check-ins land on consecutive
// keys, but it is wrong for a streak that promises "check in before *your* midnight": a user in
// America/Chicago who checks in at 23:50 on Sep 12 has a `scheduledDate` of Sep 13.
//
// `localDate` is written by the check-in handler from the user's IANA timezone
// (`main.users.settingsTimezone`, then the device timezone the client reports, then the
// service fallback) at the instant of the write. It is the only column the daily streak
// evaluator reads — see utilities/dailyStreak.ts.
//
// Nullable here; the backfill is the next migration so it can be re-run on its own.
//
// Index: the evaluator's one read is "this user's distinct completed local days in a range",
// and the check-in hook's is "how many completed check-ins on (user, localDate)". Both lead on
// userId and range/equality on localDate.
//
// Idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS) per
// therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE habits."habit_checkins" ADD COLUMN IF NOT EXISTS "localDate" date');
    await knex.raw(
        'CREATE INDEX IF NOT EXISTS "idx_habit_checkins_user_local_date" '
        + 'ON habits."habit_checkins" ("userId", "localDate")',
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS habits."idx_habit_checkins_user_local_date"');
    await knex.raw('ALTER TABLE habits."habit_checkins" DROP COLUMN IF EXISTS "localDate"');
};
