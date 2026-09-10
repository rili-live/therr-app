// Create habits.journal_entries — free-text notes the user writes into the
// Journal feed.
//
// Archetype: Niche-schema (per docs/NICHE_APP_DATABASE_GUIDELINES.md). Lives in
// `habits.*` and carries no `brandVariation` column — the Journal is a Friends
// with Habits surface and rows here are never read in a Therr or Teem context.
//
// WHY A SEPARATE TABLE FROM habit_checkins.notes
//
// `habits.habit_checkins` already has a `notes` column, and the Journal feed
// does surface it. It cannot carry these entries though, because
// habit_checkins is UNIQUE (userId, habitGoalId, scheduledDate) — one row per
// habit per day, by design, since that is what makes a check-in idempotent.
// The Journal needs the opposite: several notes on the same day, and notes with
// no habit at all (the screenshot that drove this feature has exactly that —
// "I woke up before the alarm which felt good", tagged to nothing). Forcing
// those through the check-in table would mean either breaking its uniqueness
// invariant or inventing synthetic habit ids.
//
// `habitGoalId` is therefore nullable — an untagged note is a first-class
// entry, not a degenerate one — and `checkinId` is an optional link for the
// case where a note is written from the check-in flow, so the feed can collapse
// the pair into one item instead of showing it twice.
//
// WHY occurredAt AND entryDate BOTH EXIST
//
// `occurredAt` is the sort/paginate key across all five journal feed sources
// and is a timestamptz. `entryDate` is the *local* calendar day the entry
// belongs to, resolved on the client, and is what day-grouping uses. They are
// not redundant: a note written at 23:40 in UTC-07:00 sorts by an instant that
// falls on the following UTC day, and grouping by the timestamp would file it
// under tomorrow in the user's own journal. `habits.habit_checkins` already
// makes the same split (`scheduledDate` date vs `completedAt` timestamptz), so
// this matches the schema's existing convention rather than inventing one.
//
// Index strategy:
//   - (userId, occurredAt DESC) serves the only read path there is: this
//     user's feed, newest first, paginated by a cursor on occurredAt.
//
// Idempotent (hasTable probe, CREATE INDEX IF NOT EXISTS) per
// therr/require-idempotent-migration. createTable is guarded rather than using
// createTableIfNotExists, which Knex itself warns against and the lint rule
// flags.

const TABLE = 'habits.journal_entries';

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('habits').hasTable('journal_entries');

    if (!exists) {
        await knex.schema.withSchema('habits').createTable('journal_entries', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('userId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');

            // Nullable: an untagged note is a first-class entry. SET NULL rather
            // than CASCADE on delete — deleting a habit goal should not silently
            // destroy the user's writing about it.
            table.uuid('habitGoalId')
                .references('id').inTable('habits.habit_goals')
                .onUpdate('CASCADE')
                .onDelete('SET NULL');

            // Optional link when the note was written from the check-in flow, so
            // the feed can render one item instead of a note and a check-in
            // saying the same thing.
            table.uuid('checkinId')
                .references('id').inTable('habits.habit_checkins')
                .onUpdate('CASCADE')
                .onDelete('SET NULL');

            table.text('body').notNullable();

            // The local calendar day this entry belongs to — see the header note
            // on why this is not derived from occurredAt.
            table.date('entryDate').notNullable();

            table.timestamp('occurredAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        });
    }

    // Created outside the table builder so a re-run against an existing table
    // still converges on the full index set.
    await knex.raw(
        `CREATE INDEX IF NOT EXISTS "journal_entries_userId_occurredAt_idx"
         ON ${TABLE} ("userId", "occurredAt" DESC)`,
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS habits."journal_entries_userId_occurredAt_idx"');
    await knex.schema.withSchema('habits').dropTableIfExists('journal_entries');
};
