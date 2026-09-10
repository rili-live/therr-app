/**
 * Add brandVariation to main.userAchievements.
 *
 * Archetype: Brand-scoped (per docs/NICHE_APP_DATABASE_GUIDELINES.md).
 *
 * Phase 5 of the multi-app data isolation rollout. Habits has its own achievement set
 * (HABITS_PROJECT_BRIEF.md "Habit Builder" / "Consistency" classes — see
 * therr-public-library/therr-js-utilities/src/config/achievements/) that is genuinely
 * disjoint from Therr's classes. Without brand scoping, a user enrolled in both apps would
 * see Therr's "explorer" / "influencer" tier progress mixed into Habits' achievements list
 * and vice versa, and the same `claim` endpoint could reward unclaimed points across brands.
 *
 * Defaults:
 *   - NOT NULL with default 'therr' for legacy rows (every existing achievement row was
 *     earned under the original Therr app).
 *   - UserAchievementsStore stays in 'shadow' mode for one release cycle. Flip to 'enforce'
 *     in code after shadow logs are clean.
 *
 * Index strategy:
 *   - Composite (userId, brandVariation, achievementClass) covers the dominant lookup:
 *     "give me this user's progress in this class for this app." userId leads because per-user
 *     selectivity dominates — there are millions of users vs ~7 brands. The class column tail
 *     supports the "tier" join in updateAndCreateConsecutive (filters by class, then sorts by
 *     achievementId). The existing single-column userId index is retained because it serves
 *     cross-brand admin / analytics queries (e.g. exporting a user's full achievement history
 *     during a GDPR request).
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.schema.withSchema('main').alterTable('userAchievements', (table) => {
        table.string('brandVariation', 50).notNullable().defaultTo('therr');
    });
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_userAchievements_user_brand_class
        ON main."userAchievements" ("userId", "brandVariation", "achievementClass")
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main."idx_userAchievements_user_brand_class"');
    await knex.schema.withSchema('main').alterTable('userAchievements', (table) => {
        table.dropColumn('brandVariation');
    });
};
