exports.up = (knex) => knex.schema.withSchema('habits').createTable('pact_activities', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

    // References
    table.uuid('pactId').notNullable()
        .references('id').inTable('habits.pacts')
        .onUpdate('CASCADE').onDelete('CASCADE');
    table.uuid('userId').notNullable()
        .references('id').inTable('main.users')
        .onUpdate('CASCADE').onDelete('CASCADE');
    table.uuid('targetUserId')
        .references('id').inTable('main.users')
        .onUpdate('CASCADE').onDelete('SET NULL');

    // Activity Type
    table.string('activityType', 30).notNullable();
    // Types: checkin_completed, checkin_skipped, celebration_sent, encouragement_sent,
    //        streak_milestone, streak_broken, partner_joined, pact_started, pact_completed

    // Related entities
    table.uuid('checkinId')
        .references('id').inTable('habits.habit_checkins')
        .onUpdate('CASCADE').onDelete('SET NULL');

    // Activity Data
    table.jsonb('data'); // { message, streakDays, milestoneReached, etc. }

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('pactId');
    table.index('userId');
    table.index('activityType');
    table.index('createdAt');
    table.index(['pactId', 'createdAt']);
});

exports.down = (knex) => knex.schema.withSchema('habits').dropTableIfExists('pact_activities');
