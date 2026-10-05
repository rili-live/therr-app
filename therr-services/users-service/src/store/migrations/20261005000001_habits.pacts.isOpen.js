// Open pacts: a creator can let people outside their contacts ask to join.
//
//   - isOpen: boolean, NOT NULL, default false. False is what every existing pact means, and
//     is the default for every new one — opening a pact is an explicit, optional choice.
//     While true, the pact is listed by GET /habits/pacts/open to other users tracking the
//     same habit, who can send a join request the creator approves or declines
//     (habits.pact_join_requests).
//   - openSuggestionSentAt: timestamptz, nullable. Set once, by the daily habits digest, when
//     it prompts this pact's creator — whose invitees never answered — to ask to join someone
//     else's open pact on the same habit. Claimed with a conditional UPDATE before sending, so
//     the prompt goes out at most once per pact across re-runs and over both channels (the
//     push is queued with a dedupe key, but the email fallback has no queue to dedupe in).
//
// The partial index serves the one read that filters on isOpen: the open-pact listing, which
// only ever wants the (small) open set.
//
// Additive only, so neither automator can break on it. Idempotent
// (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS) per therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE habits."pacts" ADD COLUMN IF NOT EXISTS "isOpen" boolean NOT NULL DEFAULT false');
    await knex.raw('ALTER TABLE habits."pacts" ADD COLUMN IF NOT EXISTS "openSuggestionSentAt" timestamptz');
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_pacts_is_open
        ON habits."pacts" ("habitGoalId")
        WHERE "isOpen" = true
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS habits.idx_pacts_is_open');
    await knex.raw('ALTER TABLE habits."pacts" DROP COLUMN IF EXISTS "openSuggestionSentAt"');
    await knex.raw('ALTER TABLE habits."pacts" DROP COLUMN IF EXISTS "isOpen"');
};
