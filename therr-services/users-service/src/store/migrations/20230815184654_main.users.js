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

// knex runs the alterTable callback synchronously while it collects the statement list, and
// discards whatever the callback returns. An `async` callback therefore splits this migration
// in two: the column definitions before the first `await` land in the ALTER TABLE, and the
// raws after it resume as floating promises that nothing awaits — `up` resolves as soon as the
// ALTER TABLE does.
//
// That was survivable only while knex wrapped the entire batch in one transaction, which kept a
// connection open long enough for the stragglers to land. 20260727000000 sets
// `transaction: false`, and knex switches to a transaction per migration the moment any single
// migration opts out — so this one now commits at the ALTER TABLE and the trailing raws hit a
// closed transaction ("Transaction query already complete").
//
// Awaiting each step in sequence is also the order this always needed: the lat/long columns have
// to exist before the ST_MakePoint backfill reads them, which previously held only by luck of
// how the two overlapping statements happened to queue on the connection.
exports.up = async (knex) => {
    await installExtensions(knex);

    await knex.schema.withSchema('main').alterTable('users', (table) => {
        table.double('lastKnownLatitude', 15).nullable();
        table.double('lastKnownLongitude', 15).nullable();
    });

    // Postgis
    await knex.schema.raw(`SELECT AddGeometryColumn('main', 'users', 'lastKnownLocation', 4326, 'POINT', 2);`); // eslint-disable-line quotes
    await knex.schema.raw(`UPDATE main.users SET "lastKnownLocation" = ST_SetSRID(ST_MakePoint("lastKnownLongitude", "lastKnownLatitude"), 4326);`); // eslint-disable-line quotes
    await knex.schema.raw(`CREATE INDEX idx_users_last_known_location ON main.users USING gist("lastKnownLocation");`); // eslint-disable-line quotes
};

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('lastKnownLatitude');
    table.dropColumn('lastKnownLongitude');
    table.dropColumn('lastKnownLocation');
});
