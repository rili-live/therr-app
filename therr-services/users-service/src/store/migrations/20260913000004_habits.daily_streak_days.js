// Per-day ledger for the app-level daily streak — one row per (user, local day) the evaluator
// has finalized (plus a live row for today once a check-in lands). Source of truth for the
// celebration screen's 7-day strip and for perfect-week detection.
//
//   status        — 'upheld'  : >= 1 completed check-in on any habit with localDate = this day
//                   'frozen'  : no check-in, but a streak freeze was borrowed from one habit's
//                               habits.streaks row (graceDaysUsed += 1) so the streak survived
//                   'missed'  : no check-in and no freeze; the streak reset to 0 on this day
//   freezeHabitGoalId — the habit the freeze was borrowed from when status = 'frozen'. Needed so
//                   a backdated check-in that fills the day can refund it. SET NULL on goal
//                   delete rather than CASCADE: the day still happened.
//   streakAfter   — the daily streak length at the end of this day.
//
// Rows are rewritten only through the rewind path (a backdated check-in for yesterday, or the
// only check-in for a day being deleted): every row >= that day is deleted, borrowed freezes are
// refunded, and the walk re-runs. That keeps the ledger a pure function of the check-ins plus
// the freeze pool, which is what makes evaluation idempotent.
//
// habits schema; no brandVariation column (see habits.user_daily_streaks).
//
// Idempotent per therr/require-idempotent-migration (hasTable probe around createTable).

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('habits').hasTable('daily_streak_days');
    if (exists) {
        return;
    }

    await knex.schema.withSchema('habits').createTable('daily_streak_days', (table) => {
        table.uuid('userId').notNullable()
            .references('id').inTable('main.users')
            .onUpdate('CASCADE')
            .onDelete('CASCADE');
        table.date('localDate').notNullable();
        table.string('status', 16).notNullable();
        table.uuid('freezeHabitGoalId')
            .references('id').inTable('habits.habit_goals')
            .onUpdate('CASCADE')
            .onDelete('SET NULL');
        table.integer('streakAfter').notNullable().defaultTo(0);
        table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

        table.primary(['userId', 'localDate']);
        table.check("\"status\" IN ('upheld', 'frozen', 'missed')", undefined, 'daily_streak_days_status_check');
    });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = (knex) => knex.schema.withSchema('habits').dropTableIfExists('daily_streak_days');
