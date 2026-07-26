// Persist the relevance score that the thought distributor already computes.
//
// Context: users-service `ThoughtsStore.getRecentThoughts` ranks candidate thoughts by an
// engagement-aware "hot" score (reply count dampened by age) to decide WHICH thoughts get
// activated into a user's stream. That score then had nowhere to live — activation wrote a
// `thoughtReactions` row and the feed read those rows back ordered by the reaction's
// `createdAt`. Because a distributor run activates 7-20 thoughts in a single batch with
// effectively identical timestamps, the ranking was discarded and intra-batch order was
// arbitrary.
//
// `relevanceScore` carries the score onto the reaction row so the feed can order by it.
// Nullable rather than defaulted to 0: NULL means "activated before scoring existed", which
// the read path sorts last via NULLS LAST. Backfilling to 0 would be indistinguishable from
// a genuinely low-scoring thought.
//
// NOTE: on first deploy, previously-activated rows (relevanceScore IS NULL) sort below all
// newly scored ones. That is a one-time reshuffle in the intended direction — scored content
// leads — but it is visible to existing users on the first feed load after rollout.
// Raw ADD COLUMN IF NOT EXISTS rather than the knex table builder, so this can be re-run
// against a database where the columns were already added by hand — e.g. when the index is
// pre-built CONCURRENTLY ahead of the deploy (see the note below). `real` and `timestamptz`
// are exactly what `table.float()` / `table.timestamp({ useTz: true })` compile to on pg;
// keep them in step if this ever moves back to the builder. Both are nullable by default.
//
// `real` is float4 (~6 significant digits), which is ample for a ranking score — the
// double-precision binding in `ThoughtReactionsStore.updateRelevanceScores` narrows on
// assignment, which is intended and does not affect ordering.
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE main."thoughtReactions" ADD COLUMN IF NOT EXISTS "relevanceScore" real');
    await knex.raw('ALTER TABLE main."thoughtReactions" ADD COLUMN IF NOT EXISTS "scoredAt" timestamptz');

    // Covering the activated-feed read path:
    //   WHERE "userId" = ? AND "userHasActivated" = true
    //   ORDER BY "relevanceScore" DESC NULLS LAST, "createdAt" DESC
    // Partial on userHasActivated because the feed never reads deactivated rows, which keeps
    // the index materially smaller than the existing (thoughtId, userId) unique index.
    await knex.raw(
        'CREATE INDEX IF NOT EXISTS idx_thought_reactions_user_relevance '
        + 'ON main."thoughtReactions" ("userId", "relevanceScore" DESC NULLS LAST, "createdAt" DESC) '
        + 'WHERE "userHasActivated" = true',
    );
};

// Symmetrically idempotent: `dropColumn` throws on an already-absent column, which would
// leave a partial rollback wedged (index gone, columns still there) and un-re-runnable.
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main.idx_thought_reactions_user_relevance');
    await knex.raw('ALTER TABLE main."thoughtReactions" DROP COLUMN IF EXISTS "scoredAt"');
    await knex.raw('ALTER TABLE main."thoughtReactions" DROP COLUMN IF EXISTS "relevanceScore"');
};
