exports.up = (knex) => knex.schema.withSchema('main').createTable('messages', (table) => {
    table.increments('id');
    table.string('message').notNullable();
    table.integer('fromUserId').notNullable();
    table.integer('toUserId').notNullable();
    table.string('locale', 8);
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('messages');
