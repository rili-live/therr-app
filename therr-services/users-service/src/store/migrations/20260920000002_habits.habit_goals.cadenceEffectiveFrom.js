// habits.habit_goals.cadenceEffectiveFrom — the date a habit's cadence became authoritative.
//
// WHY
//
// Two problems, one column.
//
// 1. EDITING. A user may change a habit's cadence (dial "every day" back to "4x a week" after an
//    injury, say) and keep their streak; the new cadence governs from the change date forward.
//    Without a marker, the next evaluation would judge the whole gap since the last check-in by
//    whichever cadence happens to be on the row now, retroactively rewriting days that were lived
//    under the old one. Stamping the change date and refusing to evaluate before it makes the
//    change forward-only, with no cadence-history table to maintain.
//
// 2. GRANDFATHERING. Cadence columns have existed on this table since 20260126000002, and one
//    seeded template ("Save for a group trip", 20260510000001) is `weekly`/1 — so real users hold
//    non-daily goals today. Under the old countMissedDaysForStreak their streaks were effectively
//    unbreakable: its bare-weekly branch only registered a miss after a gap of more than two whole
//    weeks. The new rule breaks a weekly streak after one unmet week, which is stricter, so
//    shipping it unclamped would retroactively reset streaks those users believe they hold.
//
//    Backfilling CURRENT_DATE onto every non-daily goal means no pre-deploy week is ever judged by
//    the new rule. The change is forward-only for existing non-daily habits exactly as it is for
//    an edit.
//
// NULL means "always", which is the correct and untouched value for every `daily` goal — i.e. for
// almost every row. `utilities/habitCadence.ts` (`countMissedPeriods`) is the only reader.
//
// IDEMPOTENCY
//
// `ADD COLUMN IF NOT EXISTS` carries its own guard, and the backfill's WHERE clause excludes rows
// it has already written, so a re-run touches nothing.

const TABLE = 'habits.habit_goals';

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw(`
        ALTER TABLE ${TABLE}
        ADD COLUMN IF NOT EXISTS "cadenceEffectiveFrom" date
    `);

    // Only non-daily goals need the clamp. A daily goal's rules are unchanged by this release, so
    // leaving it NULL keeps its history fully evaluable.
    //
    // "Non-daily" has to match `getCadence`, which resolves an explicit weekday schedule ahead of
    // `frequencyType` in BOTH directions — a row carrying `frequencyType = 'daily'` alongside a
    // populated `targetDaysOfWeek` is a weekday-scheduled habit, not a daily one, and nothing
    // server-side has ever constrained that pair. Keying this on `frequencyType` alone would leave
    // exactly those rows unclamped, which is the shape the old countMissedDaysForStreak got wrong
    // (it honoured targetDaysOfWeek only when frequencyType was 'weekly') and the reason a
    // perfectly-kept 3x/week habit was scored against all seven days.
    await knex.raw(`
        UPDATE ${TABLE}
        SET "cadenceEffectiveFrom" = CURRENT_DATE
        WHERE "cadenceEffectiveFrom" IS NULL
            AND (
                "frequencyType" IS DISTINCT FROM 'daily'
                OR COALESCE(array_length("targetDaysOfWeek", 1), 0) > 0
            )
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw(`
        ALTER TABLE ${TABLE}
        DROP COLUMN IF EXISTS "cadenceEffectiveFrom"
    `);
};
