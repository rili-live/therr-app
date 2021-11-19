exports.up = (knex) => knex.schema.withSchema('main').createTable('notifications', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('userId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('type', 100).notNullable();
    table.uuid('associationId');
    table.bool('isUnread').notNullable().defaultTo(true);
    table.text('messageLocaleKey').notNullable();
    table.jsonb('messageParams');

    // Audit
    table.timestamp('createdAt', {
        useTz: true,
    }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', {
        useTz: true,
    }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('userId').index(['userId', 'updatedAt']);
});

exports.down = (knex) => knex.schema.dropTable('main.notifications');
