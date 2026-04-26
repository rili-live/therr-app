/**
 * Add brandVariation to main.directMessages.
 *
 * Archetype: Brand-scoped (per docs/NICHE_APP_DATABASE_GUIDELINES.md).
 *
 * Phase 3 of the multi-app data isolation rollout. Without this column, two users signed into
 * the same app see DMs that one of them sent under a different brand interleaved with their
 * current-brand thread. With it, every DM is stamped with the sender's brand at create time
 * and reads are filtered to the requester's current brand. A "Therr DM" between A and B is a
 * different thread from a "Habits DM" between A and B.
 *
 * Auto-enroll semantic (per the architecture decision): a recipient who hasn't yet opened the
 * sender's brand will not see the DM. The first time they open that brand, the existing login
 * path (UsersStore.upsertBrandVariation) enrolls them and the DM becomes visible. No new
 * notification or auto-enroll endpoint is needed at this phase.
 *
 * Defaults:
 *   - NOT NULL with default 'therr' so legacy rows (all created before this migration ran by
 *     the original Therr app) keep showing up to Therr users.
 *   - DirectMessagesStore stays in shadow mode for one release cycle.
 *
 * Index strategy:
 *   - Composite (toUserId, fromUserId, brandVariation, updatedAt) covers the dominant query
 *     pattern: latest DMs in this brand for this user pair. brandVariation goes after the
 *     user-id pair because user-pair selectivity is much higher than brand selectivity (~7
 *     possible brands vs millions of user pairs). Replaces nothing — keep the original
 *     (toUserId, fromUserId) index because it serves writes and existing analytics queries.
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.schema.withSchema('main').alterTable('directMessages', (table) => {
        table.string('brandVariation', 50).notNullable().defaultTo('therr');
    });
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_dm_to_from_brand_updated
        ON main."directMessages" ("toUserId", "fromUserId", "brandVariation", "updatedAt" DESC)
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main.idx_dm_to_from_brand_updated');
    await knex.schema.withSchema('main').alterTable('directMessages', (table) => {
        table.dropColumn('brandVariation');
    });
};
