exports.up = (knex) => knex.schema.withSchema('main').alterTable('userGroups', (table) => {
    table.unique(['userId', 'groupId']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('userGroups', (table) => {
    table.dropUnique(['userId', 'groupId']);
});
