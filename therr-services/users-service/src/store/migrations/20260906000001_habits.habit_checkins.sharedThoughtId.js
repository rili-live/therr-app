// Link from a check-in to the public post it was shared as (see docs/WORK_IN_PROGRESS.md 2.6.8).
//
// Sharing a check-in publicly mints a `main.thoughts` row carrying a *copy* of the proof image
// in the public bucket (the private proof is never referenced — see handlers/habitCheckins.ts
// § SHARE and the media copy in utilities/shareCheckinMedia.ts). `sharedThoughtId` is the edge
// from the check-in to that post, so:
//   - a repeat share is a no-op rather than a second post (the handler short-circuits when this
//     is already set), and
//   - the calendar day / day sheet can show "shared" and deep-link to ViewThought, the same way
//     the journal already opens a goal.
//
// No FK to main.thoughts(id), and deliberately so: the two rows have independent lifecycles.
// Deleting the check-in must not retract a post that already has replies, and deleting the post
// must not destroy the user's own check-in record. A dangling id is harmless — the client
// resolves the post through a normal (brand-scoped) thought read and renders nothing when it
// misses, which is also what a deleted or cross-brand post requires. This matches the reasoning
// for main.thoughts."repostThoughtId" and habits.pacts."renewedFromPactId", neither of which
// carries an FK.
//
// Index: the only read is "resolve the shared post for this check-in" / "which of this range's
// check-ins are shared", both `sharedThoughtId IS NOT NULL` probes. Partial on NOT NULL — shared
// check-ins are a small fraction of the table, so the index stays small and the planner still
// uses it.
//
// Idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS) per
// therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE habits."habit_checkins" ADD COLUMN IF NOT EXISTS "sharedThoughtId" uuid');
    await knex.raw(
        'CREATE INDEX IF NOT EXISTS "idx_habit_checkins_shared_thought_id" '
        + 'ON habits."habit_checkins" ("sharedThoughtId") WHERE "sharedThoughtId" IS NOT NULL',
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS habits."idx_habit_checkins_shared_thought_id"');
    await knex.raw('ALTER TABLE habits."habit_checkins" DROP COLUMN IF EXISTS "sharedThoughtId"');
};
