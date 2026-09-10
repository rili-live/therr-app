/**
 * brandVariations normalization for multi-app auth.
 *
 * Two cleanups:
 *
 * 1. Earlier signups (handlers/helpers/user.ts:282-287 prior to this commit) wrote a single
 *    JSONB *object* into a column whose default is a JSONB *array*. Normalize any object-shaped
 *    rows to a single-element array so downstream code can safely treat the column as a list of
 *    brand memberships.
 *
 * 2. Add a GIN index so per-brand membership queries (e.g. "active users in HABITS in last 30d")
 *    don't degrade as the array grows. jsonb_path_ops is the smaller / faster operator class for
 *    containment-style lookups, which is the predominant access pattern here.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async (knex) => {
    await knex.raw(`
        UPDATE main.users
        SET "brandVariations" = jsonb_build_array("brandVariations")
        WHERE jsonb_typeof("brandVariations") = 'object';
    `);

    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_users_brand_variations_gin
        ON main.users USING GIN ("brandVariations" jsonb_path_ops);
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main.idx_users_brand_variations_gin;');
    // Object-shaped rows are not restored; they were inconsistent with the column default.
};
