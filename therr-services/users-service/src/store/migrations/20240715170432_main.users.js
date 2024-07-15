/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => knex.schema.withSchema('main').alterTable('users', async (table) => {
    table.index('accessLevels', 'users_access_levels_index', {
        indexType: 'GIN',
    });
});

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropIndex('accessLevels', 'users_access_levels_index');
});
