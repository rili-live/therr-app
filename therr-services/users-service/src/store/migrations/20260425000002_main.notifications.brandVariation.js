/**
 * Add brandVariation to main.notifications.
 *
 * Archetype: Brand-scoped (per docs/NICHE_APP_DATABASE_GUIDELINES.md).
 *
 * Phase 2 of the multi-app data isolation rollout. Until this column exists,
 * a user signed into multiple apps with the same identity sees notifications
 * from every app interleaved. With it, NotificationsStore (extending
 * BrandScopedStore) filters every read and stamps every write so cross-app
 * leakage is impossible at the data layer.
 *
 * Defaults:
 *   - NOT NULL with default 'therr' so legacy rows (all created before this
 *     migration ran by the original Therr app) keep showing up to Therr users.
 *   - NotificationsStore stays in shadow mode for one release cycle. After
 *     shadow logs are clean, flip to enforce mode in code (no follow-up
 *     migration needed).
 *
 * Index strategy:
 *   - Composite (userId, brandVariation, isUnread) covers the dominant query
 *     pattern: "give me my unread notifications for this app." brandVariation
 *     is in the middle position because it has very low cardinality (one of
 *     ~7 brand enum values), so leading with userId keeps the per-user prefix
 *     selective and the brand filter narrows from there before isUnread
 *     applies. Replaces nothing — the existing single-column userId index and
 *     (userId, updatedAt) index stay because they serve different access
 *     patterns (count by user, sort by recency).
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.schema.withSchema('main').alterTable('notifications', (table) => {
        table.string('brandVariation', 50).notNullable().defaultTo('therr');
    });
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_notifications_user_brand_unread
        ON main.notifications ("userId", "brandVariation", "isUnread")
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main.idx_notifications_user_brand_unread');
    await knex.schema.withSchema('main').alterTable('notifications', (table) => {
        table.dropColumn('brandVariation');
    });
};
