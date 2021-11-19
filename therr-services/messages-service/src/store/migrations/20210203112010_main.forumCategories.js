exports.up = (knex) => knex.schema.withSchema('main').createTable('forumCategories', (table) => {
    table.string('categoryTag')
        .references('tag')
        .inTable('main.categories')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.uuid('forumId')
        .references('id')
        .inTable('main.forums')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');

    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.primary(['categoryTag', 'forumId']);
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('forumCategories');
