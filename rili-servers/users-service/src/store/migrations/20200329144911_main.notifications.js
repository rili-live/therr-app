exports.up = (knex) => knex.schema.withSchema('main').createTable('notifications', (table) => {
    table.increments('id');
    table.integer('userId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('type', 100).notNullable();
    table.integer('associationId');
    table.bool('isUnread').notNullable().defaultTo(true);
    table.string('message');
    table.jsonb('messageParams');
    table.timestamp('createdAt', {
        useTz: true,
    }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', {
        useTz: true,
    }).notNullable().defaultTo(knex.fn.now());

    table.index('userId').index(['userId', 'updatedAt']);
});

exports.down = (knex) => knex.schema.dropTable('main.notifications');
