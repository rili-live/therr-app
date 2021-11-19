exports.up = (knex) => knex.schema.withSchema('main').createTable('media', async (table) => {
    table.uuid('id').notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('fromUserId').notNullable();
    table.string('altText').notNullable().defaultsTo('');
    table.string('type').notNullable();
    table.string('path').notNullable();

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('id');
    table.index('fromUserId');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('media');
