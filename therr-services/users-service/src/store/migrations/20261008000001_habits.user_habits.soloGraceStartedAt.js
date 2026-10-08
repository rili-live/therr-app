// The first-habit solo grace (#3010).
//
//   - soloGraceStartedAt: timestamptz, nullable. Set on the one tracking row a user started
//     alone *without* having earned solo tracking by invites — their first solo habit, which they
//     may track for SOLO_GRACE_DAYS before one sent invite is needed to keep checking in
//     (handlers/helpers/soloHabitAccess.ts). Null on every other row, including every row that
//     exists today, so nothing already being tracked is affected.
//
// Stored rather than derived from "the user's first habit" because that row is often a pact
// habit: an invitee whose partner later left would otherwise be locked out of a habit they never
// chose to track alone.
//
// The partial unique index is what makes the grace once per user. Two concurrent starts both
// pass the handler's "not used yet" read; only one can set the column.
//
// Additive only, so neither automator can break on it. Idempotent
// (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS) per therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE habits."user_habits" ADD COLUMN IF NOT EXISTS "soloGraceStartedAt" timestamptz');
    await knex.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_habits_solo_grace_per_user
        ON habits."user_habits" ("userId")
        WHERE "soloGraceStartedAt" IS NOT NULL
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS habits.uniq_user_habits_solo_grace_per_user');
    await knex.raw('ALTER TABLE habits."user_habits" DROP COLUMN IF EXISTS "soloGraceStartedAt"');
};
