/* eslint-disable max-len */
const installExtensions = async (knex) => {
    await knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // Postgis
    // Enable PostGIS (as of 3.0 contains just geometry/geography)
    await knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "postgis";');
    // enable raster support (for 3+)
    await knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "postgis_raster";');
    // Enable Topology
    await knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "postgis_topology";');
    // Enable PostGIS Advanced 3D
    // and other geoprocessing algorithms
    // sfcgal not available with all distributions
    await knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "postgis_sfcgal";');
    // fuzzy matching needed for Tiger
    await knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";');
    // rule based standardizer
    await knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "address_standardizer";');
    // example rule data set
    await knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "address_standardizer_data_us";');
    // Enable US Tiger Geocoder
    await knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "postgis_tiger_geocoder";');
};

exports.up = (knex) => knex.schema.withSchema('main').createTable('eventReactions', async (table) => {
    table.uuid('id').notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('eventId').notNullable();
    table.uuid('userId').notNullable();
    table.boolean('userHasActivated').notNullable().defaultTo(false);
    table.bool('userHasLiked').notNullable().defaultTo(false);
    table.bool('userHasSuperLiked').notNullable().defaultTo(false);
    table.bool('userHasDisliked').notNullable().defaultTo(false);
    table.bool('userHasSuperDisliked').notNullable().defaultTo(false);
    table.string('userLocale', 8);
    table.string('userBookmarkCategory');
    table.integer('userBookmarkPriority').notNullable().defaultTo(0);
    table.boolean('userHasReported').notNullable().defaultTo(false);
    table.boolean('isArchived').notNullable().defaultTo(false);
    table.integer('rating');
    table.uuid('contentAuthorId').nullable();
    table.integer('updateCount').notNullable().defaultTo(0);
    table.double('contentLatitude', 15).nullable();
    table.double('contentLongitude', 15).nullable();

    // Audit
    table.integer('userViewCount').notNullable().defaultTo(0);
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.unique(['eventId', 'userId']);
    table.index(['eventId', 'userId']);
    table.index(['eventId', 'rating']);
    table.index('contentAuthorId');

    // Postgis
    await knex.schema.raw(`SELECT AddGeometryColumn('main', 'eventReactions', 'contentLocation', 4326, 'POINT', 2);`); // eslint-disable-line quotes
    await knex.schema.raw(`UPDATE main."eventReactions" SET "contentLocation" = ST_SetSRID(ST_MakePoint("contentLongitude", "contentLatitude"), 4326);`); // eslint-disable-line quotes
    await knex.schema.raw(`CREATE INDEX idx_eventReactions_content_location ON main."eventReactions" USING gist("contentLocation");`); // eslint-disable-line quotes
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('eventReactions');
