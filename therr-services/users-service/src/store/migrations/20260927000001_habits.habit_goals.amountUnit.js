// Measured habits: the unit a non-savings habit counts in, when its owner opts in.
//
// A savings habit already records *how much* on every check-in
// (`habit_checkins."savedAmount"`, 20260920000002) against a target on the goal
// (`habit_goals."targetAmount"`, 20260920000001). This column extends the same machinery
// to any habit: "Read" becomes "Read — pages", "Run" becomes "Run — km".
//
//   - amountUnit: varchar(24), nullable. NULL means "not measured", which is what every
//     existing row means and what a new habit stays unless its owner turns amount tracking
//     on. Tracking an amount is opt-in for every goal type except `savings_goal`, whose
//     unit is its currency and which ignores this column. The value is one of
//     `HabitAmountUnits` (therr-js-utilities/constants/habitAmounts.ts), validated at the
//     handler rather than by a CHECK constraint so the list can grow without a migration.
//
// What the existing columns mean on a measured goal (documented here because nothing in
// the schema says it):
//   - `habit_checkins."savedAmount"` is the amount in this unit. The column name is from
//     when only money was measured. Renaming it would be an expand/contract across the
//     two automator repos for no behavioural gain.
//   - `habit_goals."targetAmount"` is a **weekly** target per member, not the cumulative
//     finish line it is on a savings goal. A habit repeats, so its target resets with the
//     habit's Monday–Sunday week, and reaching it never completes a pact.
//
// Additive only, so nothing in either automator can break on it. Idempotent
// (ADD COLUMN IF NOT EXISTS) per therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE habits."habit_goals" ADD COLUMN IF NOT EXISTS "amountUnit" varchar(24)');
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('ALTER TABLE habits."habit_goals" DROP COLUMN IF EXISTS "amountUnit"');
};
