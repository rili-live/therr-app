// Reposts for thoughts.
//
// `isRepost` has existed on this table since the original 20221222143544 migration but was
// never wired to anything — nothing recorded *what* was reposted, so the flag was write-only.
// This adds that missing edge: a repost is an ordinary `main.thoughts` row whose
// `repostThoughtId` points at the thought it re-shares. An empty `message` is a plain repost;
// a non-empty one is a quote repost.
//
// Nullable, because the overwhelming majority of rows are not reposts and a sentinel would
// just be a second way to spell NULL. No FK to main.thoughts(id): `parentId` has one with
// ON DELETE CASCADE, and that semantic is wrong here — deleting an original should not
// silently delete every quote repost of it (each carries its author's own commentary).
// Consumers already tolerate a missing original by rendering the repost without an embed,
// which is the same thing they must do for a cross-brand original anyway.
//
// Index strategy: the two reads are "hydrate the originals for this page of thoughts"
// (id IN (...), already the primary key) and "how many times was this thought reposted"
// (repostThoughtId IN (...) GROUP BY). The second one drives this index. Partial on
// NOT NULL — repost rows are a small fraction of the table, so the index stays a fraction
// of the size of a full one and the planner still uses it for every IN-list probe.
//
// Idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS) per
// therr/require-idempotent-migration: knex writes the knex_migrations row only after the
// function resolves, so a run killed partway would otherwise leave the column in place with
// no ledger row and fail on re-run.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE main."thoughts" ADD COLUMN IF NOT EXISTS "repostThoughtId" uuid');
    await knex.raw(
        'CREATE INDEX IF NOT EXISTS "idx_thoughts_repost_thought_id" '
        + 'ON main."thoughts" ("repostThoughtId") WHERE "repostThoughtId" IS NOT NULL',
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main."idx_thoughts_repost_thought_id"');
    await knex.raw('ALTER TABLE main."thoughts" DROP COLUMN IF EXISTS "repostThoughtId"');
};
