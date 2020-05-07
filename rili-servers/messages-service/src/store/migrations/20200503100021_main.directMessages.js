exports.up = (knex) => knex.schema.withSchema('main').createTable('directMessages', (table) => {
    table.increments('id');
    table.string('message').notNullable();
    table.integer('toUserId').notNullable();
    table.integer('fromUserId').notNullable();
    table.bool('isUnread').notNullable().defaultTo(true);
    table.string('locale', 8);
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['toUserId', 'fromUserId']);
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('directMessages');
