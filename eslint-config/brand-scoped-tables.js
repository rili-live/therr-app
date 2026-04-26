// List of fully-qualified table names that must only be accessed through a BrandScopedStore subclass.
// See docs/NICHE_APP_DATABASE_GUIDELINES.md ("Brand-scoped" archetype) and the BrandScopedStore base class
// in each service's src/store/ directory.
//
// Each phase of the multi-app data isolation rollout populates this list as it migrates a table:
//   Phase 2: main.notifications
//   Phase 3: main.directMessages, main.forums, main.forumMessages
//   Phase 4: main.moments, main.spaces, main.events, main.momentReactions, main.spaceReactions, main.eventReactions
//   Phase 5: main.userAchievements
//
// Adding a table here causes any string-literal reference to it (e.g. `.from('main.notifications')`,
// raw SQL `FROM main.notifications`) to be flagged by ESLint everywhere except the sanctioned store
// files listed in eslint-config/service.js overrides.
const BRAND_SCOPED_TABLES = [];

module.exports = {
    BRAND_SCOPED_TABLES,
};
