exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaceMetrics', async (table) => {
    table.double('userLatitude', 15).nullable();
    table.double('userLongitude', 15).nullable();
    // Postgis
    await knex.schema.raw(`SELECT AddGeometryColumn('main', 'spaceMetrics', 'userLocation', 4326, 'POINT', 2);`); // eslint-disable-line quotes
    // eslint-disable-next-line max-len
    await knex.schema.raw(`UPDATE main."spaceMetrics" SET "userLocation" = ST_SetSRID(ST_MakePoint("userLongitude", "userLatitude"), 4326);`); // eslint-disable-line quotes
    await knex.schema.raw(`CREATE INDEX idx_user_location ON main."spaceMetrics" USING gist("userLocation");`); // eslint-disable-line quotes
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaceMetrics', (table) => {
    table.dropColumn('userLatitude');
    table.dropColumn('userLongitude');
    table.dropColumn('userLocation');
});
