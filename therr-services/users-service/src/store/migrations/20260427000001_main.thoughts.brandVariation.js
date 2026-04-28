/**
 * Add brandVariation to main.thoughts.
 *
 * Phase of the multi-app data isolation rollout for the thoughts feed. The HABITS
 * niche app reuses this table for its "Goals" feed, so HABITS users must not see
 * therr-brand thoughts and vice versa (Therr defaults to seeing everything via the
 * BRAND_THOUGHTS_VISIBILITY allowlist in therr-js-utilities/constants).
 *
 * Defaults:
 *   - NOT NULL with default 'therr' so legacy rows (all created before this
 *     migration ran by the original Therr app) keep showing up to Therr users.
 *
 * Index strategy:
 *   - Single-column index on brandVariation. The thoughts feed's hot read paths
 *     are dominated by createdAt sort + parentId filter (already indexed) and
 *     fromUserId IN (...) lookups. brandVariation has very low cardinality
 *     (~7 brand enum values), so a leading composite would be wasted; a separate
 *     low-cardinality index lets the planner combine bitmaps when narrowing a
 *     niche-app feed against the existing createdAt/parentId indexes.
 *
 * @param { import("knex").Knex } knex
 */
exports.up = (knex) => knex.schema.withSchema('main').alterTable('thoughts', (table) => {
    table.string('brandVariation', 50).notNullable().defaultTo('therr');
    table.index('brandVariation', 'idx_thoughts_brand_variation');
});

/**
 * @param { import("knex").Knex } knex
 */
exports.down = (knex) => knex.schema.withSchema('main').alterTable('thoughts', (table) => {
    table.dropIndex('brandVariation', 'idx_thoughts_brand_variation');
    table.dropColumn('brandVariation');
});
