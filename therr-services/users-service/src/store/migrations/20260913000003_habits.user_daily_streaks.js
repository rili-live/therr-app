// App-level daily streak — one row per user, across all of their habits.
//
// Distinct from habits.streaks, which is per (user, habit goal). This is the "did you show up
// today, for anything" streak the celebration screens and the leaderboard chip read. The rules
// (what upholds a day, how freezes are borrowed from habit streaks, backdating, perfect weeks)
// live in one place: utilities/dailyStreak.ts.
//
// Columns:
//   currentStreak / longestStreak — as of the last evaluated (or live-upheld) day.
//   lastUpheldDate     — last local day with a real (non-frozen) check-in.
//   lastEvaluatedDate  — days <= this are finalized in habits.daily_streak_days. The evaluator
//                        walks from here + 1 and never re-evaluates earlier days except through
//                        the backdate/rewind path, which rewinds this column first.
//   lastCelebratedDate — one celebration per day: the server reports a pending celebration only
//                        while lastUpheldDate = today AND this != today.
//   consecutivePerfectWeeks — maintained at each week close for the perfect_week_x4 achievement.
//
// habits schema (not a main.* brand-scoped table): brand isolation is by schema; every row is a
// HABITS row. No brandVariation column, same as habits.streaks.
//
// Idempotent per therr/require-idempotent-migration (hasTable probe around createTable).

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('habits').hasTable('user_daily_streaks');
    if (exists) {
        return;
    }

    await knex.schema.withSchema('habits').createTable('user_daily_streaks', (table) => {
        table.uuid('userId').primary().notNullable()
            .references('id')
            .inTable('main.users')
            .onUpdate('CASCADE')
            .onDelete('CASCADE');

        table.integer('currentStreak').notNullable().defaultTo(0);
        table.integer('longestStreak').notNullable().defaultTo(0);
        table.date('lastUpheldDate');
        table.date('lastEvaluatedDate');
        table.date('lastCelebratedDate');
        table.integer('consecutivePerfectWeeks').notNullable().defaultTo(0);
        // Length of the streak the most recent reset destroyed, when it was >= 30; zeroed once
        // the following streak reaches 7 and the `comeback` achievement is banked.
        table.integer('lastResetFromStreak').notNullable().defaultTo(0);

        table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = (knex) => knex.schema.withSchema('habits').dropTableIfExists('user_daily_streaks');
