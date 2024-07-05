/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = (knex) => knex.schema.withSchema('main').alterTable('forums', (table) => {
    // Audit
    table.timestamp('archivedAt', { useTz: true });

    table.index(['id', 'isPublic', 'archivedAt'], 'forums_id_public_archived_index');
    table.index(['updatedAt', 'isPublic', 'archivedAt'], 'forums_updated_public_archived_index');
});

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = (knex) => knex.schema.withSchema('main').alterTable('forums', (table) => {
    table.dropIndex([], 'forums_id_public_archived_index');
    table.dropIndex([], 'forums_updated_public_archived_index');
    table.dropColumn('archivedAt');
});
