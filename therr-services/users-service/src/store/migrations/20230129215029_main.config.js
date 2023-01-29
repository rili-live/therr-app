exports.up = (knex) => knex.schema.withSchema('main').createTable('config', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('key').notNullable();
    table.string('value').notNullable();
    table.string('type').notNullable();

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.unique('key');
});

exports.down = (knex) => knex.schema.dropTable('main.config');
