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
// Idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX CONCURRENTLY IF NOT EXISTS) so it can
// be re-run against a database where the columns or index were created by hand.
// `real` / `timestamptz` / `integer` are exactly what table.float() /
// table.timestamp({ useTz: true }) / table.integer() compile to on pg, so no environment
// ends up with a different type depending on which path created the column.

// `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block (pg raises 25001), and
// knex wraps every migration in one by default. Opting this file out is what lets the index
// build without holding ACCESS EXCLUSIVE on main."userInterests" for its duration — the
// table is on the read path for getTopRankedConnections, so a blocking build would stall
// those requests on a production-sized table.
//
// The cost of dropping the transaction is that the four ALTERs, the backfill, and the index
// no longer commit or roll back as a unit, and a mid-migration failure leaves the row out of
// knex_migrations so the whole file re-runs. That is safe here only because every statement
// below is individually idempotent — keep it that way when editing.
exports.config = {
    transaction: false,
};

// A CONCURRENTLY build that fails (deadlock, cancelled session, conflicting long transaction)
// leaves the index behind marked INVALID rather than removing it. `IF NOT EXISTS` would then
// match that corpse on the retry and skip the build, leaving an index the planner will never
// use and nothing will ever repair. So clear an invalid one first — deliberately narrow, so a
// healthy index is never dropped and rebuilt.
const dropInvalidIndex = async (knex, schema, indexName) => {
    const { rows } = await knex.raw(
        `SELECT 1
           FROM pg_class c
           JOIN pg_index i ON i.indexrelid = c.oid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = ?
            AND c.relname = ?
            AND NOT i.indisvalid`,
        [schema, indexName],
    );

    if (rows.length) {
        await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${schema}.${indexName}`);
    }
};

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
    await dropInvalidIndex(knex, 'main', 'idx_user_interests_user_affinity');
    await knex.raw(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_interests_user_affinity
        ON main."userInterests" ("userId", "affinityScore" DESC)
        WHERE "isEnabled" = true
    `);
};

// Symmetrically idempotent: dropColumn throws on an already-absent column, which would leave
// a partial rollback (index dropped, columns still present) wedged and un-re-runnable.
exports.down = async (knex) => {
    // CONCURRENTLY here too — a plain DROP INDEX takes the same ACCESS EXCLUSIVE lock the
    // build was avoiding, and a rollback is exactly when the table is least able to stall.
    await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS main.idx_user_interests_user_affinity');
    await knex.raw('ALTER TABLE main."userInterests" DROP COLUMN IF EXISTS "source"');
    await knex.raw('ALTER TABLE main."userInterests" DROP COLUMN IF EXISTS "negativeCount"');
    await knex.raw('ALTER TABLE main."userInterests" DROP COLUMN IF EXISTS "lastEngagedAt"');
    await knex.raw('ALTER TABLE main."userInterests" DROP COLUMN IF EXISTS "affinityScore"');
};
