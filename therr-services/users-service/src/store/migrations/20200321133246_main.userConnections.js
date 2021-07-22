exports.up = (knex) => knex.schema.withSchema('main').createTable('userConnections', (table) => {
    table.increments('id');
    table.integer('requestingUserId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.integer('acceptingUserId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.integer('interactionCount').notNullable().defaultTo(1);
    table.enum('requestStatus', ['pending', 'complete', 'denied']).notNullable();
    table.bool('isConnectionBroken').notNullable().defaultTo(false);
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['requestingUserId', 'acceptingUserId']);
    table.index('id').index(['requestingUserId', 'acceptingUserId']).index('interactionCount');
});

exports.down = (knex) => knex.schema.dropTable('main.userConnections');
