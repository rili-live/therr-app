// Record which content algorithm scored each activated reaction row.
//
// Context: `relevanceScore` (20260726000000) carries the distributor's ranking onto the
// reaction row so the feed can order by it. Now that a user can choose between algorithms
// (main.users.settingsContentAlgorithm), a score is only interpretable alongside the profile
// that produced it — PULSE weights the hot term at 1.0 while FOCUS weights it at 0.3 and adds
// an interest term, so the two are on different scales and must never be interleaved.
//
// This column is not read by the feed ordering. Switching algorithms NULLs the user's scores
// and re-seeds the stream, so at steady state a user's activated rows are either scored under
// their current profile or unscored. `algorithmKey` exists so that invariant is observable
// (and verifiable when the reset call, which is fire-and-forget, fails) and so a future
// read-time blend can tell which rows need re-scoring rather than resetting.
//
// Nullable with no default: NULL means "activated before algorithm selection existed", which
// is exactly the same population that already has a NULL relevanceScore. Defaulting to
// 'pulse' would assert something about historical rows that we cannot actually verify.
//
// No index: nothing filters or sorts on this column. It is diagnostic.
//
// Idempotent (ADD COLUMN IF NOT EXISTS / DROP COLUMN IF EXISTS) per
// therr/require-idempotent-migration — knex writes the knex_migrations row only after the
// function resolves, so a partially-applied run must be safe to repeat.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE main."thoughtReactions" ADD COLUMN IF NOT EXISTS "algorithmKey" varchar(32)');
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('ALTER TABLE main."thoughtReactions" DROP COLUMN IF EXISTS "algorithmKey"');
};
