exports.up = (knex) => knex.schema.withSchema('main').createTable('categories', (table) => {
    table.string('tag').primary().unique().notNullable();
    table.string('name').unique().notNullable();
    table.string('iconGroup').notNullable();
    table.string('iconId', 50).notNullable();
    table.string('iconColor', 40).notNullable();

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('categories');
