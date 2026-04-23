// Add a `slug` column to user lists + a partial unique index for public lists.
//
// Context: Public lists are shared at /lists/:ownerUserId/:listSlug. The slug
// is the app-side `slugify(name)` value. Two lists with different names (e.g.
// "Date Night" and "Date-Night") can slugify to the same string, which would
// collide at the URL level. The existing idx_userlists_userid_name_lower
// prevents same-name duplicates but NOT same-slug duplicates.
//
// No backfill: public lists do not exist yet in production (the mobile toggle
// is shipping in the same release as this migration). Private lists have
// slug = NULL and do not participate in the partial unique index.
exports.up = async (knex) => {
    await knex.schema.withSchema('main').table('userLists', (table) => {
        table.string('slug', 100).nullable();
    });

    // Partial unique index: at most one public list per (userId, slug). Scoped
    // to isPublic = true AND slug IS NOT NULL so private lists (where we don't
    // compute a slug) and NULL-slug rows never trip the constraint.
    await knex.raw(
        'CREATE UNIQUE INDEX idx_userlists_userid_slug_public '
        + 'ON main."userLists" ("userId", "slug") '
        + 'WHERE "isPublic" = true AND "slug" IS NOT NULL'
    );
};

exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main.idx_userlists_userid_slug_public');
    await knex.schema.withSchema('main').table('userLists', (table) => {
        table.dropColumn('slug');
    });
};
