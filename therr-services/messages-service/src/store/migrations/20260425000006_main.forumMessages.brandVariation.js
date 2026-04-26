/**
 * Add brandVariation to main.forumMessages.
 *
 * Archetype: Brand-scoped (per docs/NICHE_APP_DATABASE_GUIDELINES.md).
 *
 * Phase 3 of the multi-app data isolation rollout. A forum message belongs to its parent
 * forum's brand. Stamping the brand on the message itself (rather than always joining to
 * forums to derive it) keeps hot-path reads single-table.
 *
 * Defaults:
 *   - NOT NULL with default 'therr' so legacy rows keep showing up to Therr users.
 *   - ForumMessagesStore stays in shadow mode for one release cycle.
 *
 * Index strategy:
 *   - Composite (forumId, brandVariation, createdAt DESC) covers the dominant query: latest
 *     messages in this forum scoped to the requester's brand. forumId is leading because the
 *     usual access pattern is "messages in forum X" with brand as a redundancy check (since
 *     a forum belongs to one brand, the brand filter is functionally a no-op once forumId is
 *     pinned, but the column still defends against query mistakes that drop the forum filter).
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.schema.withSchema('main').alterTable('forumMessages', (table) => {
        table.string('brandVariation', 50).notNullable().defaultTo('therr');
    });
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_forum_messages_forum_brand_created
        ON main."forumMessages" ("forumId", "brandVariation", "createdAt" DESC)
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main.idx_forum_messages_forum_brand_created');
    await knex.schema.withSchema('main').alterTable('forumMessages', (table) => {
        table.dropColumn('brandVariation');
    });
};
