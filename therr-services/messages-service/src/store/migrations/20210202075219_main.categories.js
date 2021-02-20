exports.up = (knex) => knex.schema.withSchema('main').createTable('categories', (table) => {
    table.string('tag').primary().unique().notNullable();
    table.string('name').unique().notNullable();
    table.string('iconGroup').notNullable();
    table.string('iconId', 50).notNullable();
    table.string('iconColor', 40).notNullable();

    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index('tag');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('categories');
