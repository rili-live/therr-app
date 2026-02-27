exports.up = (knex) => knex.schema.withSchema('habits').createTable('habit_goals', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

    // Basic Info
    table.string('name', 255).notNullable();
    table.text('description');
    table.string('category', 50); // fitness, learning, health, productivity, mindfulness, social, creative, other
    table.string('emoji', 10);

    // Frequency
    table.string('frequencyType', 20).notNullable().defaultTo('daily'); // daily, weekly, custom
    table.integer('frequencyCount').defaultTo(1); // times per frequency period
    table.specificType('targetDaysOfWeek', 'integer[]'); // [0,1,2,3,4,5,6] for custom schedules

    // Creator
    table.uuid('createdByUserId').notNullable()
        .references('id').inTable('main.users')
        .onUpdate('CASCADE').onDelete('CASCADE');

    // Template flags
    table.boolean('isTemplate').defaultTo(false); // system-provided template
    table.boolean('isPublic').defaultTo(false); // visible to other users for copying
    table.integer('usageCount').defaultTo(0); // how many pacts use this goal

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('createdByUserId');
    table.index('category');
    table.index('isTemplate');
    table.index('isPublic');
});

exports.down = (knex) => knex.schema.withSchema('habits').dropTableIfExists('habit_goals');
