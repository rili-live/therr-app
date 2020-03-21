exports.up = (knex) => knex.schema.createTable('main.userConnections', (table) => {
    table.integer('requestingUserId').references('main.users.id').onUpdate('CASCADE').onDelete('CASCADE');
    table.integer('acceptingUserId').references('main.users.id').onUpdate('CASCADE').onDelete('CASCADE');
    table.integer('interactionCount').notNullable().defaultTo(1);
    table.enum('requestStatus', ['pending', 'complete', 'denied']).notNullable();
    table.bool('isConnectionBroken').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.unique(['requestingUserId', 'acceptingUserId']);
    table.index(['requestingUserId', 'acceptingUserId']).index('requestingUserId').index('interactionCount');
});

exports.down = (knex) => knex.schema.dropTable('main.userConnections');
