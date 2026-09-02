// Give a thought an optional home on the map.
//
// Context: `main.thoughts` has never carried coordinates. That is why WANDER — the
// geo-dominant content algorithm — is fully implemented in therr-js-utilities
// `content-ranking` but deliberately unreleased: its geo term multiplies a distance that
// does not exist, so it degenerates into a weak recency feed (see SELECTABLE_CONTENT_ALGORITHMS).
//
// The immediate consumer is therr-ai-automator, whose bot accounts now have a declared
// home city (main.userLocations, isDeclaredHome) and write some of their posts *about*
// that city. Those rows are stamped with the city's coordinates so the thought distributor
// can put "posts about where you live" into a new user's feed the moment they share
// location. Human-authored thoughts leave all three columns NULL and rank exactly as
// before — every read path treats NULL as "not a local post", never as distance 0.
//
// Columns:
// - latitude / longitude: the post's subject location, not the author's live position. A
//   Chicago bot posting about Chicago from anywhere stamps Chicago. Nullable, because the
//   overwhelming majority of thoughts are not about a place.
// - locality: human-readable label ("Chicago, IL") for display and for debugging which
//   catalog entry produced a row. Deliberately NOT the matching key — proximity matching
//   is done on coordinates, so a user whose city is not in any catalog still matches.
//
// The index is partial on `latitude IS NOT NULL`. Local candidates are selected with a
// bounding box on (latitude, longitude) before the exact ST_DWithin refinement, and only a
// small minority of rows will ever have coordinates, so the partial index stays a fraction
// of the size of a full one on a table where most rows can never match it.
//
// No geography/geometry column and no GiST index: PostGIS is available in this database
// (20230815184654_main.users.js enables it) and the read path does use ST_DWithin/ST_Distance
// for the exact test, but the selective work is done by the btree bounding box. A stored
// geometry would mean either a generated column or a second value every writer — including
// a separate repository's Cloud Function — has to remember to set and keep consistent.
//
// Idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS) per
// therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE main."thoughts" ADD COLUMN IF NOT EXISTS "latitude" double precision');
    await knex.raw('ALTER TABLE main."thoughts" ADD COLUMN IF NOT EXISTS "longitude" double precision');
    await knex.raw('ALTER TABLE main."thoughts" ADD COLUMN IF NOT EXISTS "locality" varchar(100)');
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS "idx_thoughts_latitude_longitude"
        ON main."thoughts" ("latitude", "longitude")
        WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL
    `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main."idx_thoughts_latitude_longitude"');
    await knex.raw('ALTER TABLE main."thoughts" DROP COLUMN IF EXISTS "locality"');
    await knex.raw('ALTER TABLE main."thoughts" DROP COLUMN IF EXISTS "longitude"');
    await knex.raw('ALTER TABLE main."thoughts" DROP COLUMN IF EXISTS "latitude"');
};
