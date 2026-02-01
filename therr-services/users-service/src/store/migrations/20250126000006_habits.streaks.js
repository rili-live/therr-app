exports.up = (knex) => knex.schema.withSchema('habits').createTable('streaks', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

    // References
    table.uuid('userId').notNullable()
        .references('id').inTable('main.users')
        .onUpdate('CASCADE').onDelete('CASCADE');
    table.uuid('habitGoalId').notNullable()
        .references('id').inTable('habits.habit_goals')
        .onUpdate('CASCADE').onDelete('CASCADE');
    table.uuid('pactId')
        .references('id').inTable('habits.pacts')
        .onUpdate('CASCADE').onDelete('SET NULL');

    // Current Streak
    table.integer('currentStreak').notNullable().defaultTo(0);
    table.date('currentStreakStartDate');
    table.date('lastCompletedDate');

    // Records
    table.integer('longestStreak').notNullable().defaultTo(0);
    table.date('longestStreakStartDate');
    table.date('longestStreakEndDate');

    // Grace Period (premium feature)
    table.integer('gracePeriodDays').defaultTo(0); // 0 = no grace period
    table.integer('graceDaysUsed').defaultTo(0);

    // Status
    table.boolean('isActive').defaultTo(true);

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Constraints
    table.unique(['userId', 'habitGoalId']);

    // Indexes
    table.index('userId');
    table.index('habitGoalId');
    table.index('pactId');
    table.index('currentStreak');
    table.index('isActive');
});

exports.down = (knex) => knex.schema.withSchema('habits').dropTableIfExists('streaks');
