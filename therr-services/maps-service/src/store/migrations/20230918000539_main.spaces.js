exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.string('addressLocality'); // The locality of the address within the region (city)
    table.string('addressRegion'); // The region of the address within the country (state, province)
    table.string('addressStreetAddress');
    table.string('postalCode');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('addressLocality');
    table.dropColumn('addressRegion');
    table.dropColumn('addressStreetAddress');
    table.dropColumn('postalCode');
});
