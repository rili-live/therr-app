/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => knex.schema.withSchema('main').alterTable('userConnections', async (table) => {
    table.index('requestStatus');
});

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = (knex) => knex.schema.withSchema('main').alterTable('userConnections', (table) => {
    table.dropIndex('requestStatus');
});
