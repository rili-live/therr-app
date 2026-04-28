// List of fully-qualified table names that must only be accessed through a BrandScopedStore subclass.
// See docs/NICHE_APP_DATABASE_GUIDELINES.md ("Brand-scoped" archetype) and the BrandScopedStore base class
// in each service's src/store/ directory.
//
// Each phase of the multi-app data isolation rollout populates this list as it migrates a table:
//   Phase 2: main.notifications
//   Phase 3: main.directMessages, main.forums, main.forumMessages
//   Phase 5: main.userAchievements
//
// (The original Phase 4 set — main.moments / spaces / events / *Reactions — was reclassified
// Identity-shared after a niche-app audit confirmed Habits and Teem don't read or write those
// tables. See the note in docs/NICHE_APP_DATABASE_GUIDELINES.md.)
//
// Adding a table here causes any string-literal reference to it (e.g. `.from('main.notifications')`,
// raw SQL `FROM main.notifications`) to be flagged by ESLint everywhere except the sanctioned store
// files listed in eslint-config/service.js overrides.
const BRAND_SCOPED_TABLES = [
    'main.notifications',
    'main.directMessages',
    'main.forums',
    'main.forumMessages',
    'main.userAchievements',
];

module.exports = {
    BRAND_SCOPED_TABLES,
};
