exports.up = (knex) => knex.schema.withSchema('main').createTable('userAchievements', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('userId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('achievementId').notNullable();
    table.string('achievementClass').notNullable();
    table.string('achievementTier').notNullable();
    table.integer('progressCount').notNullable().defaultTo(0);

    // Audit
    table.timestamp('completedAt', { useTz: true });
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('userId').index('id');
});

exports.down = (knex) => knex.schema.dropTable('main.userAchievements');
