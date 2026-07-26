// Give the user preference model a decaying, discoverable affinity signal.
//
// Context (docs/ALGORITHM_AUDIT.md E2/E3): `engagementCount` is a monotonic counter with no
// half-life and no per-user normalization, and the only writer is an UPDATE that touches
// rows which already exist. Two consequences:
//   - A user's ranking freezes around whatever they did in their first weeks; a newly
//     acquired interest can never overtake an old one within any realistic session count.
//   - Engagement on an interest the user never declared is silently discarded, so behavior
//     can never discover a new interest.
//
// `affinityScore` replaces the counter semantics: it is decayed toward the present on every
// write (see UserInterestsStore.incrementUserInterestsByKey) rather than by a batch job, so
// stale interests fade without a nightly sweep over the whole table.
//
// SHADOW MODE: nothing reads affinityScore yet. `getInterestRanking` still ranks on
// engagementCount, which is still maintained alongside. This release only populates the new
// columns and logs how the two orderings disagree; the read path flips in a later change,
// once those logs show the distributions are sane.
//
// Idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS) so it can be re-run
// against a database where the columns or index were created by hand — which is how the
// index gets built CONCURRENTLY ahead of a deploy without holding ACCESS EXCLUSIVE.
// `real` / `timestamptz` / `integer` are exactly what table.float() /
// table.timestamp({ useTz: true }) / table.integer() compile to on pg, so no environment
// ends up with a different type depending on which path created the column.
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE main."userInterests" ADD COLUMN IF NOT EXISTS "affinityScore" real NOT NULL DEFAULT 0');
    await knex.raw('ALTER TABLE main."userInterests" ADD COLUMN IF NOT EXISTS "lastEngagedAt" timestamptz');
    // Reserved for the negative-signal path (hide / not-interested / report). Nothing writes
    // it yet; the shadow weight already divides by it so the formula is complete when it does.
    await knex.raw('ALTER TABLE main."userInterests" ADD COLUMN IF NOT EXISTS "negativeCount" integer NOT NULL DEFAULT 0');
    // 'declared' = created by the user picking it during onboarding/preferences.
    // 'implicit' = created by the engagement upsert because the user engaged with content
    // tagged with an interest they never picked. Records how the row was CREATED and is
    // never rewritten, so an implicit row stays identifiable for a future "you keep opening
    // coffee content — enable coffee?" prompt.
    await knex.raw('ALTER TABLE main."userInterests" ADD COLUMN IF NOT EXISTS "source" varchar(16) NOT NULL DEFAULT \'declared\'');

    // Seed affinity from the signal we already have rather than starting everyone cold, so
    // the shadow comparison is meaningful from day one instead of after weeks of accrual.
    // `lastEngagedAt` is seeded from updatedAt so decay runs from each row's real last
    // activity — that is what lets the imported (undecayed) counts start fading immediately
    // instead of importing the old recency bias permanently.
    await knex.raw(`
        UPDATE main."userInterests"
           SET "affinityScore" = "engagementCount",
               "lastEngagedAt" = "updatedAt"
         WHERE "lastEngagedAt" IS NULL
    `);

    // The engagement upsert conflicts on (userId, interestId) — already covered by the
    // unique constraint from 20240429134308. This index serves the read side: pulling one
    // user's interests strongest-first, which is what the ranking path will do once the
    // read flips over. Partial on isEnabled to match how getByUserIds filters today.
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_user_interests_user_affinity
        ON main."userInterests" ("userId", "affinityScore" DESC)
        WHERE "isEnabled" = true
    `);
};

// Symmetrically idempotent: dropColumn throws on an already-absent column, which would leave
// a partial rollback (index dropped, columns still present) wedged and un-re-runnable.
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main.idx_user_interests_user_affinity');
    await knex.raw('ALTER TABLE main."userInterests" DROP COLUMN IF EXISTS "source"');
    await knex.raw('ALTER TABLE main."userInterests" DROP COLUMN IF EXISTS "negativeCount"');
    await knex.raw('ALTER TABLE main."userInterests" DROP COLUMN IF EXISTS "lastEngagedAt"');
    await knex.raw('ALTER TABLE main."userInterests" DROP COLUMN IF EXISTS "affinityScore"');
};
