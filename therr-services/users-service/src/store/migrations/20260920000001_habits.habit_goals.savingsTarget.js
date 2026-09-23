// Savings targets on a habit goal — the "how much" behind a `savings_goal` habit.
//
// `habits.habit_goals.goalType` has carried a `savings_goal` value since
// 20260428000001, but nothing ever recorded an *amount*: a savings habit was a habit you
// checked in on, identical in every respect to a `build_good` one except for which
// achievement ladder it fed. A group saving for a trip could say "we are saving" and
// never say "for how much", so the pact could only ever end on its duration.
//
// These three columns are what make a savings habit measurable. They live on the habit
// goal rather than on `habits.pacts` because a goal covers both cases the feature has:
// a pact's members all share one `pacts.habitGoalId`, and a solo tracked habit
// (`habits.user_habits`) has a goal and no pact at all. Putting the target on the pact
// would leave solo savers with nowhere to record one.
//
// The safety of that depends on goals being per-user rather than shared, which they are:
// the client clones a template row into a fresh goal when a habit is created (see
// `createHabitGoal` in the mobile create-habit wizard), so writing a target onto a goal
// cannot reach another user's habit. Seeded `isTemplate` rows are the exception and
// deliberately carry a suggested target of NULL.
//
//   - targetAmount: numeric(12,2), nullable. NULL means "no target" — an open-ended
//     savings habit, which stays valid; the goal is then never "reached" and the pact
//     ends on its duration as it does today. numeric (not float) because this is money
//     and 0.1 + 0.2 must not be 0.30000000000000004 when it is summed over 90 check-ins.
//     12,2 tops out just under a trillion minor units, which is far more headroom than a
//     group trip fund needs and still fits a bigint of cents if this is ever re-based.
//   - currencyCode: ISO 4217, nullable. Display only — no conversion happens anywhere,
//     and mixing currencies inside one pact is prevented by there being a single goal.
//   - savingsTargetScope: whether `targetAmount` is what *each member* saves or what the
//     group saves *between them*. Both readings of "save $2,000 for the trip" are real
//     (each of us puts in 2k / we need 2k in the pot) and they complete the pact on
//     completely different days, so this is stored rather than assumed. NULL reads as
//     'per_member' — see utilities/savingsProgress.ts, which owns the default.
//
// Idempotent (ADD COLUMN IF NOT EXISTS) per therr/require-idempotent-migration: knex
// writes the knex_migrations row only after the function resolves, so a run killed
// partway would otherwise leave some columns in place with no ledger row and fail from
// the top on the next deploy.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE habits."habit_goals" ADD COLUMN IF NOT EXISTS "targetAmount" numeric(12,2)');
    await knex.raw('ALTER TABLE habits."habit_goals" ADD COLUMN IF NOT EXISTS "currencyCode" varchar(3)');
    await knex.raw('ALTER TABLE habits."habit_goals" ADD COLUMN IF NOT EXISTS "savingsTargetScope" varchar(20)');
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('ALTER TABLE habits."habit_goals" DROP COLUMN IF EXISTS "savingsTargetScope"');
    await knex.raw('ALTER TABLE habits."habit_goals" DROP COLUMN IF EXISTS "currencyCode"');
    await knex.raw('ALTER TABLE habits."habit_goals" DROP COLUMN IF EXISTS "targetAmount"');
};
