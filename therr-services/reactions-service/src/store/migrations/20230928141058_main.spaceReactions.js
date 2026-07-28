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

// Sequenced explicitly rather than nested inside an async alterTable callback: knex invokes that
// callback synchronously and discards its promise, so the Postgis raws below would escape the
// migration and could outlive its transaction. See eslint-config/migration-rules.js.
exports.up = async (knex) => {
    await installExtensions(knex);

    await knex.schema.withSchema('main').alterTable('spaceReactions', (table) => {
        table.uuid('contentAuthorId').nullable();
        table.integer('updateCount').notNullable().defaultTo(0);
        table.double('contentLatitude', 15).nullable();
        table.double('contentLongitude', 15).nullable();

        table.index('contentAuthorId');
    });

    // Postgis
    await knex.schema.raw(`SELECT AddGeometryColumn('main', 'spaceReactions', 'contentLocation', 4326, 'POINT', 2);`); // eslint-disable-line quotes
    await knex.schema.raw(`UPDATE main."spaceReactions" SET "contentLocation" = ST_SetSRID(ST_MakePoint("contentLongitude", "contentLatitude"), 4326);`); // eslint-disable-line quotes
    await knex.schema.raw(`CREATE INDEX idx_spaceReactions_content_location ON main."spaceReactions" USING gist("contentLocation");`); // eslint-disable-line quotes
};

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaceReactions', (table) => {
    table.dropColumn('contentAuthorId');
    table.dropColumn('updateCount');
    table.dropColumn('contentLatitude');
    table.dropColumn('contentLongitude');
    table.dropColumn('contentLocation');
});
