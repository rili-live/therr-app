// Backfill habits.habit_checkins."localDate" for rows written before the column existed.
//
// Shipped as its own migration step, separate from the column add, so it can be re-run: it only
// touches rows where "localDate" IS NULL, so a partial run, a retry, or a deliberate re-run after
// a timezone correction is safe and converges.
//
// The value is the check-in's `createdAt` instant rendered in the user's timezone
// (`main.users.settingsTimezone`), falling back to the same zone the habits digest falls back
// to (`America/Chicago`, see utilities/localReminderSchedule.ts FALLBACK_TIME_ZONE). This
// deliberately does NOT copy `scheduledDate`: that column is the UTC day the client stamped,
// which is exactly the value the daily streak must not use.
//
// `settingsTimezone` is validated as an IANA zone on write (handlers/users.ts), so `AT TIME ZONE`
// cannot hit an unknown name; NULLIF guards the empty string in case a legacy row carries one.
//
// The daily-streak *state* is not backfilled here. `evaluateDailyStreak` is lazy and idempotent
// — the first `GET /habits/daily-streak/me` for a user (and the nightly evaluate-all pass)
// walks their history from their earliest completed local day — so a migration does not need
// to run application code.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw(`
        UPDATE habits."habit_checkins" c
        SET "localDate" = (c."createdAt" AT TIME ZONE COALESCE(NULLIF(u."settingsTimezone", ''), 'America/Chicago'))::date
        FROM main."users" u
        WHERE u."id" = c."userId"
            AND c."localDate" IS NULL
    `);
    // Orphaned check-ins (user row gone) — keep the ledger total rather than leaving NULLs the
    // index cannot serve; the fallback zone is the best available answer.
    await knex.raw(`
        UPDATE habits."habit_checkins" c
        SET "localDate" = (c."createdAt" AT TIME ZONE 'America/Chicago')::date
        WHERE c."localDate" IS NULL
    `);
};

/**
 * Data-only backfill; the column drop in the previous migration's down() is the undo.
 */
exports.down = () => Promise.resolve();
