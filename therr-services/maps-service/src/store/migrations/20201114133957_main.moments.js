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

exports.up = (knex) => installExtensions(knex)
    .then(() => knex.schema.raw('CREATE SCHEMA IF NOT EXISTS "main";'))
    .then(() => knex.schema.withSchema('main').createTable('moments', async (table) => {
        table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('fromUserId').notNullable();
        table.string('locale', 8);
        table.bool('isPublic').notNullable().defaultTo(false);
        table.text('message').notNullable().defaultsTo('');
        table.string('notificationMsg').notNullable(); // If empty, should default to first x characters of message
        table.text('mediaIds').notNullable().defaultsTo('');
        table.text('mentionsIds').notNullable().defaultsTo(''); // Other connection/user mentions for linking
        table.text('hashTags').notNullable().defaultsTo('');
        table.integer('maxViews').notNullable().defaultsTo(0);
        table.double('latitude', 15).notNullable();
        table.double('longitude', 15).notNullable();
        table.float('radius');
        table.jsonb('polygonCoords').notNullable().defaultsTo(JSON.stringify([]));
        table.float('maxProximity').defaultTo(0.0);
        table.bool('doesRequireProximityToView').notNullable().defaultTo(false);
        table.boolean('isMatureContent').notNullable().defaultTo(false);
        table.bool('isModeratorApproved').notNullable().defaultTo(false);
        table.bool('isForSale').notNullable().defaultTo(false);
        table.bool('isHirable').notNullable().defaultTo(false);
        table.bool('isPromotional').notNullable().defaultTo(false);
        table.bool('isExclusiveToGroups').notNullable().defaultTo(false);
        table.string('category', 50).notNullable().defaultTo('uncategorized');
        table.timestamp('isScheduledAt', { useTz: true });

        // Audit
        table.integer('valuation').notNullable().defaultTo(0);
        table.string('region').notNullable(); // Also used for sharding, db locationing
        table.timestamp('expiresAt', { useTz: true });
        table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

        // Indexes
        table.index('fromUserId');

        // Postgis
        await knex.schema.raw(`SELECT AddGeometryColumn('main', 'moments', 'geom', 4326, 'POINT', 2);`); // eslint-disable-line quotes
        await knex.schema.raw(`UPDATE main.moments SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);`); // eslint-disable-line quotes
        await knex.schema.raw(`CREATE INDEX idx_moments_geom ON main.moments USING gist(geom);`); // eslint-disable-line quotes
    }));

exports.down = (knex) => knex.schema.withSchema('main').dropTable('moments');
