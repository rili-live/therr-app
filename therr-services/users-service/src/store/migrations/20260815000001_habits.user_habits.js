// Create habits.user_habits — the registry of "habits this user is tracking".
//
// Archetype: Niche-schema (per docs/NICHE_APP_DATABASE_GUIDELINES.md). Lives in
// `habits.*`, not `main.*`, and therefore carries no `brandVariation` column —
// the whole schema belongs to Friends with Habits, exactly like the sibling
// `habits.streaks` / `habits.habit_checkins` tables.
//
// WHY THIS EXISTS
//
// Until now there was no row anywhere that said "user X tracks habit Y". The
// fact was spread across three places that each answer a different question:
//
//   - `habits.pacts` / `habits.pact_members` — who agreed to what, with whom.
//   - `habits.streaks` — the consecutive-day ladder, created lazily on the
//     first check-in or on pact acceptance.
//   - `habits.habit_goals.createdByUserId` — who authored the goal template,
//     which is not the same as who tracks it (templates are shared, and a
//     partner tracks a goal they did not create).
//
// Two features need the missing fact directly:
//
//   1. The free-tier cap is now "5 active habits", not "5 pacts". Counting
//      pacts punished the social behaviour the app exists to encourage; a user
//      with one habit and four partners was at the cap. Counting tracked habits
//      is the number a user actually recognises.
//   2. Solo habits. A habit tracked without a partner has no pact row at all,
//      so before this table there was nowhere to record that it exists. Streaks
//      cannot stand in: a streak row is created on first check-in, so a habit
//      started today and not yet checked in would be invisible.
//
// WHY THERE IS NO `isSolo` COLUMN
//
// "Solo" is derived at read time as *no active pact backs this (userId,
// habitGoalId)*, not stored. Storing it would create an invariant that has to
// be maintained on every pact transition — accept, decline, abandon, complete,
// and the partner-leaves-a-group-pact case — and any missed transition leaves a
// row lying about itself. Deriving it means the natural lifecycle just works:
// when a pact ends, the habit quietly becomes personal instead of vanishing,
// which is the behaviour we want anyway.
//
// BACKFILL
//
// Existing users must not appear to have zero habits the moment this deploys —
// that would make the dashboard look empty and would let anyone re-add habits
// past the cap. The backfill unions the two places a tracked habit is currently
// observable (streaks, and active pact membership) and is written as
// INSERT ... ON CONFLICT DO NOTHING so a re-run converges.
//
// Index strategy:
//   - UNIQUE (userId, habitGoalId) — one tracking row per habit per user; also
//     the point lookup every getOrCreate does.
//   - (userId, status) serves the cap count and the dashboard list, which are
//     the only non-point queries here.
//
// Idempotent (hasTable probe, CREATE INDEX IF NOT EXISTS, ON CONFLICT DO
// NOTHING backfill) per therr/require-idempotent-migration. createTable is
// guarded rather than using createTableIfNotExists, which Knex itself warns
// against and the lint rule flags.

const TABLE = 'habits.user_habits';

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('habits').hasTable('user_habits');

    if (!exists) {
        await knex.schema.withSchema('habits').createTable('user_habits', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('userId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.uuid('habitGoalId').notNullable()
                .references('id').inTable('habits.habit_goals')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');

            // active | archived
            //
            // Archiving is the free escape hatch when a user hits the cap, so it
            // has to be reversible without losing the habit's history — hence a
            // status column rather than a delete. Check-ins, streaks and journal
            // entries all keep pointing at the habit goal either way.
            table.string('status', 20).notNullable().defaultTo('active');

            // When the user started tracking. Surfaced in the journal feed as a
            // `habit_started` item, which is why it is stored rather than read
            // off `createdAt` — a restored habit keeps its original start date.
            table.timestamp('startedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('archivedAt', { useTz: true });

            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.unique(['userId', 'habitGoalId']);
        });
    }

    // Created outside the table builder so a re-run against an existing table
    // still converges on the full index set.
    await knex.raw(
        `CREATE INDEX IF NOT EXISTS "user_habits_userId_status_idx"
         ON ${TABLE} ("userId", "status")`,
    );

    // Backfill from streaks. `habits.streaks` is UNIQUE (userId, habitGoalId),
    // so this cannot produce duplicates on its own; the ON CONFLICT guards
    // against the union with the pact-members pass below and against a re-run.
    // `startedAt` uses the streak's own createdAt so the journal's
    // `habit_started` items land on a plausible date rather than deploy day.
    await knex.raw(`
        INSERT INTO ${TABLE} ("userId", "habitGoalId", "status", "startedAt")
        SELECT s."userId", s."habitGoalId", 'active', s."createdAt"
        FROM habits.streaks s
        ON CONFLICT ("userId", "habitGoalId") DO NOTHING
    `);

    // Backfill from active pact membership — covers habits accepted into a pact
    // that have never been checked in, which therefore have no streak row yet.
    await knex.raw(`
        INSERT INTO ${TABLE} ("userId", "habitGoalId", "status", "startedAt")
        SELECT DISTINCT ON (pm."userId", p."habitGoalId")
            pm."userId", p."habitGoalId", 'active', pm."createdAt"
        FROM habits.pact_members pm
        INNER JOIN habits.pacts p ON p."id" = pm."pactId"
        WHERE pm."status" = 'active'
        ORDER BY pm."userId", p."habitGoalId", pm."createdAt" ASC
        ON CONFLICT ("userId", "habitGoalId") DO NOTHING
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS habits."user_habits_userId_status_idx"');
    await knex.schema.withSchema('habits').dropTableIfExists('user_habits');
};
