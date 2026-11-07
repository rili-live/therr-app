// Create habits.habit_pauses — one row per time a user put a tracked habit on pause.
//
// Archetype: Niche-schema (docs/NICHE_APP_DATABASE_GUIDELINES.md). Lives in `habits.*` and
// carries no brandVariation, like `habits.user_habits` and `habits.streaks` next door: the whole
// schema belongs to Friends with Habits.
//
// WHAT A PAUSE MEANS
//
// The local days in [pausedOn, resumedOn) are excused for this habit. They are not *required*
// days, so:
//
//   - the habit's own streak (`habits.streaks`) does not count them as misses and spends no
//     freeze on them (handlers/habitCheckins.ts, through `countMissedPeriods`'s `excusedDates`);
//   - the app-level daily streak treats them as days this habit asked nothing, so a day only a
//     paused habit required is a `rest` day (utilities/habitCadence.ts `computeRequiredDates`).
//
// A completed check-in is still a completed check-in: it upholds the day as it always did, and a
// check-in on a paused habit ends the pause (the user is doing the habit again).
//
// WHY A HISTORY TABLE AND NOT A COLUMN ON user_habits
//
// The daily streak is evaluated lazily and can re-walk days it already finalized (a backdated
// check-in rewinds yesterday). A `pausedAt` column on the tracking row forgets the range the
// moment the user resumes, so a re-walk the morning after resuming would judge yesterday — a
// paused day — as required and spend a freeze on it. Every past pause has to stay answerable.
//
// COLUMNS
//
//   pausedOn   date — the user's local day the pause began. Excused, inclusive.
//   resumedOn  date — the user's local day it ended. NOT excused: the day you resume counts.
//              NULL while the pause is open.
//   pausedAt / resumedAt — wall-clock stamps, for the reminder schedule and for analytics.
//   streakAtPause — the habit's streak when it was paused, so the reminders can say what is
//              being kept without re-reading `habits.streaks`.
//
// A pause resumed on the day it started covers nothing; the handler deletes that row instead of
// keeping an empty range (it is an undo, and it must not start the re-pause cooldown).
//
// Indexes, all declared inside createTable so they exist the moment the table does:
//   - partial UNIQUE (userId, habitGoalId) WHERE resumedOn IS NULL — at most one open pause per
//     habit. It is what makes a double-tap on "Pause" a no-op instead of two overlapping rows.
//   - (userId, habitGoalId, pausedOn) — the per-habit range read at check-in and the per-user
//     range read the daily streak walk makes.
//
// Idempotent per therr/require-idempotent-migration: a hasTable probe guards createTable.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('habits').hasTable('habit_pauses');
    if (!exists) {
        await knex.schema.withSchema('habits').createTable('habit_pauses', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('userId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.uuid('habitGoalId').notNullable()
                .references('id').inTable('habits.habit_goals')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');

            table.date('pausedOn').notNullable();
            table.date('resumedOn');
            table.timestamp('pausedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('resumedAt', { useTz: true });
            table.integer('streakAtPause').notNullable().defaultTo(0);

            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.unique(['userId', 'habitGoalId'], {
                indexName: 'habit_pauses_one_open_per_habit',
                predicate: knex.whereNull('resumedOn'),
            });
            table.index(['userId', 'habitGoalId', 'pausedOn'], 'habit_pauses_user_habit_pausedOn_idx');
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.schema.withSchema('habits').dropTableIfExists('habit_pauses');
};
