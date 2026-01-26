exports.up = (knex) => knex.schema.withSchema('habits').createTable('pacts', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

    // Participants
    table.uuid('creatorUserId').notNullable()
        .references('id').inTable('main.users')
        .onUpdate('CASCADE').onDelete('CASCADE');
    table.uuid('partnerUserId')
        .references('id').inTable('main.users')
        .onUpdate('CASCADE').onDelete('SET NULL');

    // Habit Goal
    table.uuid('habitGoalId').notNullable()
        .references('id').inTable('habits.habit_goals')
        .onUpdate('CASCADE').onDelete('CASCADE');

    // Pact Configuration
    table.string('pactType', 20).notNullable().defaultTo('accountability'); // accountability, challenge, support
    table.string('status', 20).notNullable().defaultTo('pending'); // pending, active, completed, abandoned, expired

    // Duration
    table.integer('durationDays').notNullable().defaultTo(30); // 7, 14, 30, 90
    table.timestamp('startDate', { useTz: true });
    table.timestamp('endDate', { useTz: true });

    // Consequences (optional premium feature)
    table.string('consequenceType', 30); // none, donation, dare, custom
    table.jsonb('consequenceDetails'); // { amount, charity, description }

    // Completion
    table.string('endReason', 30); // completed, abandoned_creator, abandoned_partner, mutual, expired
    table.uuid('winnerId').references('id').inTable('main.users').onUpdate('CASCADE').onDelete('SET NULL');
    table.decimal('creatorCompletionRate', 5, 2);
    table.decimal('partnerCompletionRate', 5, 2);

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('creatorUserId');
    table.index('partnerUserId');
    table.index('habitGoalId');
    table.index('status');
    table.index(['status', 'endDate']);
});

exports.down = (knex) => knex.schema.withSchema('habits').dropTableIfExists('pacts');
