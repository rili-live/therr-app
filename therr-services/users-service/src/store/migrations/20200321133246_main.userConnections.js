exports.up = (knex) => knex.schema.withSchema('main').createTable('userConnections', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('requestingUserId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.uuid('acceptingUserId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.enum('requestStatus', ['pending', 'complete', 'denied']).notNullable();
    table.bool('isConnectionBroken').notNullable().defaultTo(false);

    // Audit
    table.integer('interactionCount').notNullable().defaultTo(1);
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.unique(['requestingUserId', 'acceptingUserId']);
    table.index(['requestingUserId', 'acceptingUserId']).index('interactionCount');
});

exports.down = (knex) => knex.schema.dropTable('main.userConnections');
