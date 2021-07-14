exports.up = (knex) => knex.schema.withSchema('main').createTable('moments', async (table) => {
    table.increments('id').primary().notNullable();
    table.integer('fromUserId').notNullable();
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

    // audit
    table.string('region').notNullable(); // Also used for sharding, db locationing
    table.timestamp('expiresAt', { useTz: true });
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Postgis
    await knex.schema.raw(`SELECT AddGeometryColumn('main', 'moments', 'geom', 4326, 'POINT', 2);`); // eslint-disable-line quotes
    await knex.schema.raw(`UPDATE main.moments SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);`); // eslint-disable-line quotes
    await knex.schema.raw(`CREATE INDEX idx_moments_geom ON main.moments USING gist(geom);`); // eslint-disable-line quotes

    table.index('id');
    table.index('fromUserId');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('moments');
