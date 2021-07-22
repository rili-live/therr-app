exports.up = (knex) => knex.schema.withSchema('main').alterTable('forumCategories', (table) => {
    table.unique(['categoryTag', 'forumId']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('forumCategories', (table) => {
    table.dropUnique(['categoryTag', 'forumId']);
});
