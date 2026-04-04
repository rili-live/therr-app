exports.up = (knex) => knex.schema.withSchema('habits').createTable('streak_history', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

    // References
    table.uuid('streakId').notNullable()
        .references('id').inTable('habits.streaks')
        .onUpdate('CASCADE').onDelete('CASCADE');
    table.uuid('userId').notNullable()
        .references('id').inTable('main.users')
        .onUpdate('CASCADE').onDelete('CASCADE');
    table.uuid('checkinId')
        .references('id').inTable('habits.habit_checkins')
        .onUpdate('CASCADE').onDelete('SET NULL');

    // Event
    table.string('eventType', 30).notNullable(); // completed, missed, reset, grace_used, milestone_reached
    table.date('eventDate').notNullable();

    // Streak State (snapshot)
    table.integer('streakBefore').notNullable();
    table.integer('streakAfter').notNullable();

    // Milestone (if eventType = milestone_reached)
    table.integer('milestoneReached'); // 3, 7, 14, 30, 60, 90, 180, 365

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('streakId');
    table.index('userId');
    table.index('eventDate');
    table.index('eventType');
});

exports.down = (knex) => knex.schema.withSchema('habits').dropTableIfExists('streak_history');
