// Create habits.habit_phases — the per-(user, habit) lifecycle state that decides
// how hard the app is allowed to push about a habit.
//
// Archetype: Niche-schema (per docs/NICHE_APP_DATABASE_GUIDELINES.md). Lives in
// `habits.*`, not `main.*`, and therefore carries no `brandVariation` column —
// the whole schema belongs to Friends with Habits, exactly like the sibling
// `habits.streaks` / `habits.habit_checkins` tables. Rows here are never read in
// a Therr or Teem context, so there is no cross-brand read to scope.
//
// WHY THIS EXISTS (see docs/HABIT_LIFECYCLE_MESSAGING.md)
//
// The daily digest currently nudges at one fixed intensity forever: if you have
// an active streak and haven't checked in, you get a push, on day 3 and on day
// 300 alike. That is the wrong shape for two independent reasons.
//
//   1. It over-sends to people who have already succeeded. Industry data puts
//      opt-out at ~46% of users receiving 2-5 pushes a week, and frequency
//      without relevance is the most-cited reason people disable notifications
//      permanently. Someone 200 days into a habit does not need a nightly
//      reminder, and sending one spends opt-in they will need later.
//   2. It under-serves people who lapse. Nothing currently notices that a
//      once-solid habit has stopped, so the app has no moment at which it can
//      offer a restart.
//
// This table is what makes "how established is this habit?" a durable fact
// rather than something recomputed and forgotten each run. It has to outlive
// `habits.streaks.currentStreak`, because a streak resets to 0 the moment
// someone misses — and "was established, then lapsed" is precisely the state
// the comeback flow keys on. Deriving phase from the live streak alone would
// make a lapsed veteran indistinguishable from a brand-new user.
//
// WHY THE THRESHOLDS ARE NOT STORED HERE
//
// `phase` is recorded; the gates that move a row between phases live in
// `src/utilities/habitPhaseEngine.ts` as pure functions. Thresholds are product
// policy and will be tuned against real cohorts. Storing the evaluated *result*
// and not the *rule* means a threshold change re-evaluates everyone on the next
// digest, rather than leaving rows stamped with a rule nobody remembers.
//
// Index strategy:
//   - UNIQUE (userId, habitGoalId) — one lifecycle per habit per user, and the
//     lookup the digest does per member per pact.
//   - (phase, establishedAt) serves the maintenance sweep, which asks "which
//     established habits are due a 30/60/90-day check-in?" and is the only
//     query here that is not a point lookup.
//
// Idempotent (hasTable probe, ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT
// EXISTS) per therr/require-idempotent-migration. createTable is guarded rather
// than using createTableIfNotExists, which Knex itself warns against and the
// lint rule flags.

const TABLE = 'habits.habit_phases';

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('habits').hasTable('habit_phases');

    if (!exists) {
        await knex.schema.withSchema('habits').createTable('habit_phases', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('userId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.uuid('habitGoalId').notNullable()
                .references('id').inTable('habits.habit_goals')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');

            // forming | established | maintaining | lapsed
            //
            // Deliberately a varchar and not a pg enum: these names are product
            // vocabulary and adding an enum value is DDL that cannot share a
            // transaction with other DDL. The engine validates the set.
            table.string('phase', 20).notNullable().defaultTo('forming');

            // The date the adaptive establish gate passed — i.e. when daily
            // nudging tapered. This is the anchor the 30/60/90-day maintenance
            // check-ins count from, which is why it is a stored date rather than
            // being re-derived: the whole point of a maintenance check-in is to
            // ask "did it hold after we backed off?", so it must count from the
            // day we actually backed off, not from the habit's creation.
            table.date('establishedAt');

            // The date the automaticity gate passed and daily nudges stopped
            // entirely.
            table.date('automaticityAt');

            // Highest maintenance check-in already delivered (0 | 30 | 60 | 90).
            // Monotonic. Belt-and-braces alongside the notification queue's
            // dedupe key: the queue guarantees at-most-once delivery, this
            // guarantees the sweep doesn't keep *considering* a stage it has
            // already passed, and it survives the queue's retention sweep
            // dropping old rows.
            table.integer('maintenanceStage').notNullable().defaultTo(0);

            // Set when an established/maintaining habit is detected as dropped.
            // Cleared on recovery. Nullable rather than a boolean so "when did
            // this stop?" stays answerable.
            table.date('lapsedAt');

            // Last comeback offer, so the engine can rate-limit re-offers to a
            // lapsed user independently of the notification queue's retention.
            table.date('lastComebackAt');

            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.unique(['userId', 'habitGoalId']);
        });
    }

    // Created outside the table builder so a re-run against an existing table
    // still converges on the full index set.
    await knex.raw(
        `CREATE INDEX IF NOT EXISTS "habit_phases_maintenance_idx"
         ON ${TABLE} ("phase", "establishedAt")`,
    );
    await knex.raw(
        `CREATE INDEX IF NOT EXISTS "habit_phases_userId_idx"
         ON ${TABLE} ("userId")`,
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS habits."habit_phases_maintenance_idx"');
    await knex.raw('DROP INDEX IF EXISTS habits."habit_phases_userId_idx"');
    await knex.schema.withSchema('habits').dropTableIfExists('habit_phases');
};
