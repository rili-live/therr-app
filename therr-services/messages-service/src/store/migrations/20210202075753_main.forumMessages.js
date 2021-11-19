exports.up = (knex) => knex.schema.withSchema('main').createTable('forumMessages', (table) => {
    table.uuid('id').primary().notNullable()
        .defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('forumId')
        .references('id')
        .inTable('main.forums')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('message').notNullable();
    table.uuid('fromUserId').notNullable();
    table.string('fromUserLocale', 8);

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index('forumId');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('forumMessages');
