exports.up = (knex) => knex.schema.withSchema('main').createTable('integrations', (table) => {
    table.uuid('id').primary().notNullable()
        .defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name').notNullable();
    table.string('tag').notNullable();
    table.jsonb('config').notNullable().defaultsTo(JSON.stringify({}));
    table.string('iconGroup').notNullable();
    table.string('iconId', 50).notNullable();
    table.string('iconColor', 40).notNullable();

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('integrations');
