// How much money one check-in put away.
//
// The companion to `habits.habit_goals.targetAmount` (previous migration): the target
// says what a savings habit is aiming at, this says what was actually contributed on a
// given day. A savings pact's progress is the sum of these, so the per-check-in row is
// deliberately the only place an amount is stored — no running total is denormalized
// onto `pacts` or `pact_members`.
//
// That is a considered trade. A stored total would have to be kept correct across the
// check-in upsert (`createOrUpdate` re-runs for the same (userId, habitGoalId,
// scheduledDate) whenever someone edits a note or adds a photo), the edit endpoint, and
// the delete endpoint — three write paths that would each have to apply a delta rather
// than a value, which is precisely the shape that drifts. Summing is a single indexed
// aggregate over one member's rows for one goal, and a savings pact is bounded by its
// `durationDays`, so the widest sum this feature can ask for is ~90 rows.
//
//   - savedAmount: numeric(12,2), nullable. NULL is not 0: it means this check-in
//     recorded no amount, which is the normal state of every non-savings check-in and
//     also of a savings check-in the user completed without filling the field in. The
//     distinction matters for "you checked in but didn't say how much" prompts, and
//     SUM() ignores NULL either way. Negative values are rejected at the handler rather
//     than by a CHECK constraint, so that a bad client sees a 400 with a translated
//     message instead of a 500 from a constraint violation.
//
// The index is partial, on (habitGoalId, userId) WHERE "savedAmount" IS NOT NULL. Money
// rows are a small minority of `habit_checkins` — only savings habits write them — so a
// partial index keeps both the index and the write cost proportional to the feature
// rather than to the whole table. Leading on habitGoalId matches the aggregate the pact
// detail runs, which sums every member's rows for one goal; userId second serves the
// per-member breakdown from the same index.
//
// Idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS) per
// therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE habits."habit_checkins" ADD COLUMN IF NOT EXISTS "savedAmount" numeric(12,2)');
    await knex.raw(`CREATE INDEX IF NOT EXISTS habit_checkins_savedamount_index
        ON habits."habit_checkins" ("habitGoalId", "userId")
        WHERE "savedAmount" IS NOT NULL`);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS habits.habit_checkins_savedamount_index');
    await knex.raw('ALTER TABLE habits."habit_checkins" DROP COLUMN IF EXISTS "savedAmount"');
};
