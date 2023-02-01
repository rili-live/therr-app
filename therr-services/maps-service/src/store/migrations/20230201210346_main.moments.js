// nearbySpacesSnapshot is used for drafted moments so we can get nearby spaces without requiring location
// to edit a drafted moment
exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', async (table) => {
    table.jsonb('nearbySpacesSnapshot').defaultsTo(JSON.stringify([]));
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropColumn('nearbySpacesSnapshot');
});
