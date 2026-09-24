// Add 'rest' to the statuses a day on the app-level daily streak ledger may carry.
//
// WHY
//
// The daily streak required a completed check-in on EVERY local calendar day. For a user whose
// habits are not daily — "4 workouts a week", on whichever four days suit them — the other three
// days were scored 'missed', and each one borrowed a streak freeze from a habit's pool
// (utilities/dailyStreak.ts, pickFreezeSource). The pool starts at 1 and caps at 3
// (MAX_GRACE_PERIOD_DAYS), so by the second week it was empty and the streak reset — while the
// user had done exactly what they committed to. The app was punishing the behaviour it asked for.
//
// 'rest' is the missing verdict: a day on which nothing was required of the user. It neither
// upholds the streak nor breaks it, and it borrows no freeze. Which days those are is decided by
// utilities/habitCadence.ts (`isRequiredOn`); for a daily habit no day is ever a rest day, so
// every existing row and every daily user is unaffected.
//
// The four statuses now mean:
//   'upheld' — >= 1 completed check-in on any habit with localDate = this day
//   'frozen' — nothing completed on a day that WAS required, and a freeze was borrowed
//   'missed' — nothing completed on a day that WAS required, and no freeze was left
//   'rest'   — nothing was required; the streak is untouched and no freeze is spent
//
// NO BACKFILL
//
// Existing rows record what actually happened under the old rules and are never re-judged — the
// ledger is append-only per day, rewritten only by the rewind path (a backdated check-in, or the
// deletion of a day's only check-in). Changing history here would move streak numbers under users
// with no check-in to justify it. Only evaluation from this deploy forward changes.
//
// IDEMPOTENCY
//
// The constraint is a named table-level CHECK created by 20260913000004_habits.daily_streak_days.js
// (`daily_streak_days_status_check`). DROP ... IF EXISTS followed by ADD CONSTRAINT is the shape
// therr/require-idempotent-migration asks for on an ADD CONSTRAINT, and re-running converges: the
// drop tolerates the constraint's absence and the add always recreates it.

const CONSTRAINT_NAME = 'daily_streak_days_status_check';

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw(`
        ALTER TABLE habits.daily_streak_days
        DROP CONSTRAINT IF EXISTS ${CONSTRAINT_NAME}
    `);

    await knex.raw(`
        ALTER TABLE habits.daily_streak_days
        ADD CONSTRAINT ${CONSTRAINT_NAME}
        CHECK ("status" IN ('upheld', 'frozen', 'missed', 'rest'))
    `);
};

/**
 * @param { import("knex").Knex } knex
 *
 * Rolling back re-narrows the CHECK, which Postgres validates against existing rows — so any
 * 'rest' day written since the deploy has to go first. They are rewritten to 'missed' rather than
 * deleted: 'missed' is what the pre-'rest' code would have recorded for those days, so the ledger
 * stays a complete record of every evaluated day and the walk can still re-derive from it.
 */
exports.down = async (knex) => {
    await knex.raw(`
        UPDATE habits.daily_streak_days
        SET "status" = 'missed'
        WHERE "status" = 'rest'
    `);

    await knex.raw(`
        ALTER TABLE habits.daily_streak_days
        DROP CONSTRAINT IF EXISTS ${CONSTRAINT_NAME}
    `);

    await knex.raw(`
        ALTER TABLE habits.daily_streak_days
        ADD CONSTRAINT ${CONSTRAINT_NAME}
        CHECK ("status" IN ('upheld', 'frozen', 'missed'))
    `);
};
