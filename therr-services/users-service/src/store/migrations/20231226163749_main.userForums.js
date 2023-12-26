exports.up = (knex) => knex.schema.withSchema('main').createTable('userForums', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('userId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.uuid('groupId').notNullable();
    table.string('role').notNullable().defaultTo('default');
    table.string('status').notNullable().defaultTo('pending-request');
    table.bool('shouldMuteNotifs').notNullable().defaultTo(true);
    table.bool('shouldShareLocation').notNullable().defaultTo(false);
    table.integer('engagementCount').notNullable().defaultTo(0);

    // Audit
    table.timestamp('joinedAt', { useTz: true });
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('userId').index('groupId');
});

exports.down = (knex) => knex.schema.dropTable('main.userForums');
