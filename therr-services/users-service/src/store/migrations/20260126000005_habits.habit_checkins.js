exports.up = (knex) => knex.schema.withSchema('habits').createTable('habit_checkins', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

    // References
    table.uuid('userId').notNullable()
        .references('id').inTable('main.users')
        .onUpdate('CASCADE').onDelete('CASCADE');
    table.uuid('pactId')
        .references('id').inTable('habits.pacts')
        .onUpdate('CASCADE').onDelete('SET NULL');
    table.uuid('habitGoalId').notNullable()
        .references('id').inTable('habits.habit_goals')
        .onUpdate('CASCADE').onDelete('CASCADE');

    // Scheduling
    table.date('scheduledDate').notNullable(); // The date this checkin is for
    table.timestamp('completedAt', { useTz: true }); // When user marked complete

    // Status
    table.string('status', 20).notNullable().defaultTo('pending'); // pending, completed, partial, skipped, missed

    // Content
    table.text('notes');
    table.integer('selfRating'); // 1-5 how well they did
    table.integer('difficultyRating'); // 1-5 how hard it was

    // Proof (optional)
    table.boolean('hasProof').defaultTo(false);
    table.boolean('proofVerified').defaultTo(false);

    // Streak impact
    table.boolean('contributedToStreak').defaultTo(false);

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Constraints - one checkin per user per habit per day
    table.unique(['userId', 'habitGoalId', 'scheduledDate']);

    // Indexes
    table.index('userId');
    table.index('pactId');
    table.index('habitGoalId');
    table.index('scheduledDate');
    table.index('status');
    table.index(['userId', 'scheduledDate']);
});

exports.down = (knex) => knex.schema.withSchema('habits').dropTableIfExists('habit_checkins');
