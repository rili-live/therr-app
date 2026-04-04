exports.up = (knex) => knex.schema.withSchema('habits').createTable('pact_members', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

    // References
    table.uuid('pactId').notNullable()
        .references('id').inTable('habits.pacts')
        .onUpdate('CASCADE').onDelete('CASCADE');
    table.uuid('userId').notNullable()
        .references('id').inTable('main.users')
        .onUpdate('CASCADE').onDelete('CASCADE');

    // Role & Status
    table.string('role', 20).notNullable().defaultTo('partner'); // creator, partner
    table.string('status', 20).notNullable().defaultTo('pending'); // pending, active, completed, left, removed

    // Lifecycle
    table.timestamp('invitedAt', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('joinedAt', { useTz: true });
    table.timestamp('leftAt', { useTz: true });

    // Stats (denormalized for quick access)
    table.integer('totalCheckins').defaultTo(0);
    table.integer('completedCheckins').defaultTo(0);
    table.integer('currentStreak').defaultTo(0);
    table.integer('longestStreak').defaultTo(0);
    table.decimal('completionRate', 5, 2);

    // Preferences
    table.boolean('shouldMuteNotifs').defaultTo(false);
    table.time('dailyReminderTime');
    table.boolean('celebratePartnerCheckins').defaultTo(true);

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Constraints
    table.unique(['pactId', 'userId']);

    // Indexes
    table.index('pactId');
    table.index('userId');
    table.index('status');
});

exports.down = (knex) => knex.schema.withSchema('habits').dropTableIfExists('pact_members');
