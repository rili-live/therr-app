/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => knex.schema.withSchema('main').alterTable('users', async (table) => {
    table.string('userName').nullable().unique().alter();
});

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropUnique('userName');
});
