/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => knex.schema.withSchema('main').alterTable('userMetrics', async (table) => {
    table.index('dimensions', 'dimensions_index', {
        indexType: 'GIN',
    });
});

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = (knex) => knex.schema.withSchema('main').alterTable('userMetrics', (table) => {
    table.dropIndex('dimensions', 'dimensions_index');
});
