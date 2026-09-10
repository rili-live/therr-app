/**
 * Create main.userDeviceTokens — per-(user, brand, platform) FCM/APNS device tokens.
 *
 * Archetype: Brand-scoped (per docs/NICHE_APP_DATABASE_GUIDELINES.md).
 *
 * Phase 2 of the multi-app data isolation rollout. Replaces the single
 * `users.deviceMobileFirebaseToken` column, which is the highest-stakes
 * cross-app leak today: when a user installs a second branded app on the same
 * device, that column gets overwritten with the new app's token. Subsequent
 * notifications from the original brand then either (a) silently drop because
 * the token now belongs to a different Firebase project, or (b) get delivered
 * to the wrong app. Routing tokens by (userId, brandVariation, platform)
 * makes the bug structurally impossible.
 *
 * Migration story (no backfill of historical column):
 *   - This migration only creates the new table; it does not copy from
 *     `users.deviceMobileFirebaseToken`. The historical column has no brand
 *     marker — copying it would just guess a brand (most likely 'therr') and
 *     produce wrong-app routing for any user whose device was last registered
 *     under a non-Therr brand. Existing tokens stay readable by the old
 *     code path during the dual-write window described below.
 *
 *   - Code will dual-write for one release cycle: the existing UpdateUser
 *     handler keeps writing `users.deviceMobileFirebaseToken` AND now also
 *     upserts the (userId, brand, platform, token) row in this new table.
 *     Push routing reads from this table first; falls back to the old column
 *     if no row exists yet. Once mobile clients have re-registered (typically
 *     on next app open), the fallback can be deleted in a follow-up commit.
 *
 *   - The old column itself is left in place by this migration so a rollback
 *     is non-destructive. It will be dropped in a follow-up migration after
 *     the dual-write window closes and shadow logs confirm the new path is
 *     authoritative.
 *
 * Index / constraint strategy:
 *   - UNIQUE (userId, brandVariation, platform) — at most one active token
 *     per user per app per platform. Re-registration is an UPDATE on this
 *     unique row, not an INSERT.
 *   - Index on (userId, brandVariation) for the hot read path "give me this
 *     user's tokens for this brand."
 *   - Index on token for the invalid-token cleanup path
 *     (clearInvalidDeviceToken).
 *
 * @param { import("knex").Knex } knex
 */
exports.up = (knex) => knex.schema.withSchema('main').createTable('userDeviceTokens', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

    table.uuid('userId').notNullable()
        .references('id').inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');

    table.string('brandVariation', 50).notNullable();
    table.string('platform', 20).notNullable(); // 'ios' | 'android' | 'web'
    table.text('token').notNullable();

    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['userId', 'brandVariation', 'platform']);
    table.index(['userId', 'brandVariation']);
    table.index('token');
});

/**
 * @param { import("knex").Knex } knex
 */
exports.down = (knex) => knex.schema.withSchema('main').dropTableIfExists('userDeviceTokens');
