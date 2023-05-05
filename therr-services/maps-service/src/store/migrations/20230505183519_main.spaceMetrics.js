exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaceMetrics', async (table) => {
    table.dropIndex('name');
    table.index(['spaceId', 'createdAt']);
    table.index(['spaceId', 'name']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaceMetrics', (table) => {
    table.index('name');
    table.dropIndex(['spaceId', 'createdAt']);
    table.dropIndex(['spaceId', 'name']);
});
