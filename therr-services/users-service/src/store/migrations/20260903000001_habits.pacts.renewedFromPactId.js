// Renewal lineage for pacts — makes "re-commit for 30 days" a *continuation* rather than
// an unexplained second row in the user's list.
//
// A renewal has always been a new `habits.pacts` row on the same habit goal rather than a
// mutation of the old one (see handlers/pacts.ts § RENEW: the old cycle keeps its own dates,
// completion rates and history, and `habits.streaks` carries across on its own because it is
// keyed (userId, habitGoalId), never on pactId). That is the right storage model and it is
// not changing here. What was missing was the *edge*: nothing recorded which pact a pact was
// a renewal of, so the list had no way to tell "you have two pacts" from "you have one pact,
// now in its second cycle", and rendered both — which reads as a duplicate.
//
// `renewedFromPactId` is that edge, pointing from each cycle at the one it continues. The
// reverse direction is derived, not stored: `PactsStore` resolves the newest non-abandoned
// successor per pact in one correlated subquery (`supersededByPactId`). Storing it on the
// parent as well would mean two writes that can disagree, and the parent row is the one a
// concurrent double-tap races on.
//
// No FK to habits.pacts(id), for the same reason main.thoughts."repostThoughtId" has none:
// `creatorUserId` cascades from main.users, so deleting a user would either cascade through
// renewal chains belonging to *other* members or block on them. A dangling id is harmless
// here — every read resolves the link through a join and renders nothing when it misses,
// which is what a cross-brand or deleted predecessor requires anyway.
//
// `renewalCycleNumber` is denormalized on purpose. It is what lets a card say "cycle 3"
// without walking the chain on every list read, and it is written once, at renewal, from the
// predecessor's value. Legacy rows get 1: a pact with no recorded predecessor is, as far as
// anything can know, a first cycle.
//
// Index: the only read is "does this pact already have a successor" / "resolve the successor
// for this page of pacts", both `renewedFromPactId IN (...)`. Partial on NOT NULL — renewals
// are a small fraction of the table, so the index stays a fraction of the size of a full one
// and the planner still uses it for every probe.
//
// Idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS) per
// therr/require-idempotent-migration: knex writes the knex_migrations row only after the
// function resolves, so a run killed partway would otherwise leave the columns in place with
// no ledger row and fail from the top on the next deploy.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE habits."pacts" ADD COLUMN IF NOT EXISTS "renewedFromPactId" uuid');
    await knex.raw(
        'ALTER TABLE habits."pacts" ADD COLUMN IF NOT EXISTS "renewalCycleNumber" integer NOT NULL DEFAULT 1',
    );
    await knex.raw(
        'CREATE INDEX IF NOT EXISTS "idx_pacts_renewed_from_pact_id" '
        + 'ON habits."pacts" ("renewedFromPactId") WHERE "renewedFromPactId" IS NOT NULL',
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS habits."idx_pacts_renewed_from_pact_id"');
    await knex.raw('ALTER TABLE habits."pacts" DROP COLUMN IF EXISTS "renewalCycleNumber"');
    await knex.raw('ALTER TABLE habits."pacts" DROP COLUMN IF EXISTS "renewedFromPactId"');
};
