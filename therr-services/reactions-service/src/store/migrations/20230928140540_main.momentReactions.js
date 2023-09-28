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

exports.up = (knex) => installExtensions(knex).then(() => knex.schema.withSchema('main').alterTable('momentReactions', async (table) => {
    table.uuid('contentAuthorId').nullable();
    table.integer('updateCount').notNullable().defaultTo(0);
    table.double('contentLatitude', 15).nullable();
    table.double('contentLongitude', 15).nullable();

    table.index('contentAuthorId');
    // Postgis
    await knex.schema.raw(`SELECT AddGeometryColumn('main', 'momentReactions', 'contentLocation', 4326, 'POINT', 2);`); // eslint-disable-line quotes
    await knex.schema.raw(`UPDATE main."momentReactions" SET "contentLocation" = ST_SetSRID(ST_MakePoint("contentLongitude", "contentLatitude"), 4326);`); // eslint-disable-line quotes
    await knex.schema.raw(`CREATE INDEX idx_momentReactions_content_location ON main."momentReactions" USING gist("contentLocation");`); // eslint-disable-line quotes
}));

exports.down = (knex) => knex.schema.withSchema('main').alterTable('momentReactions', (table) => {
    table.dropColumn('contentAuthorId');
    table.dropColumn('updateCount');
    table.dropColumn('contentLatitude');
    table.dropColumn('contentLongitude');
    table.dropColumn('contentLocation');
});
