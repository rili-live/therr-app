exports.up = (knex) => knex.schema.withSchema('main').createTable('forumMessages', (table) => {
    table.increments('id');
    table.integer('forumId')
        .references('id')
        .inTable('main.forums')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('message').notNullable();
    table.integer('fromUserId').notNullable();
    table.string('fromUserLocale', 8);
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index('forumId').index('id');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('forumMessages');
