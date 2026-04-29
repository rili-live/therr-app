/**
 * Add brandVariation to main.forums.
 *
 * Archetype: Brand-scoped (per docs/NICHE_APP_DATABASE_GUIDELINES.md).
 *
 * Phase 3 of the multi-app data isolation rollout. A forum belongs to a single brand — joining
 * a "running buddies" forum on Habits should not surface that forum to a Therr user with the
 * same identity. Reads filter by brand; creates stamp brand at insert time.
 *
 * Defaults:
 *   - NOT NULL with default 'therr' so legacy rows keep showing up to Therr users.
 *   - ForumsStore stays in shadow mode for one release cycle.
 *
 * Index strategy:
 *   - Composite (brandVariation, isPublic, archivedAt) covers the discovery query for the
 *     public forum feed within a brand. archivedAt is included because the dominant filter
 *     is `whereNull('archivedAt')` — a partial-index alternative was rejected because the
 *     planner already handles the IS NULL predicate well with a btree index.
 *   - Per-author lookups (`authorId`) keep the existing single-column index; brand isn't
 *     leading there because authorId is far more selective.
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.schema.withSchema('main').alterTable('forums', (table) => {
        table.string('brandVariation', 50).notNullable().defaultTo('therr');
    });
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_forums_brand_public_archived
        ON main."forums" ("brandVariation", "isPublic", "archivedAt")
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main.idx_forums_brand_public_archived');
    await knex.schema.withSchema('main').alterTable('forums', (table) => {
        table.dropColumn('brandVariation');
    });
};
