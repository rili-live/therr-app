// Sequenced explicitly rather than nested inside an async alterTable callback: knex invokes that
// callback synchronously and discards its promise, so the Postgis raws below would escape the
// migration and could outlive its transaction. See eslint-config/plugin/rules/no-async-table-builder-callback.js.
exports.up = async (knex) => {
    await knex.schema.withSchema('main').alterTable('spaces', (table) => {
        table.index('isMatureContent');
    });

    // Postgis
    await knex.schema.raw(`SELECT AddGeometryColumn('main', 'spaces', 'geomCenter', 4326, 'POINT', 2);`); // eslint-disable-line quotes
    await knex.schema.raw(`UPDATE main.spaces SET "geomCenter" = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);`); // eslint-disable-line quotes, max-len
    await knex.schema.raw(`CREATE INDEX idx_spaces_geom_center ON main.spaces USING gist("geomCenter");`); // eslint-disable-line quotes
};

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropIndex('isMatureContent');
    table.dropColumn('geomCenter');
});
