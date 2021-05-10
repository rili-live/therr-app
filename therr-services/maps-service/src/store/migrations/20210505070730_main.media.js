exports.up = (knex) => knex.schema.withSchema('main').createTable('media', async (table) => {
    table.increments('id').primary().notNullable();
    table.integer('fromUserId').notNullable();
    table.string('altText').notNullable().defaultsTo('');
    table.string('type').notNullable();
    table.string('path').notNullable();

    // audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index('id');
    table.index('fromUserId');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('media');
