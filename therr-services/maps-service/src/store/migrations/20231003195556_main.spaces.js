exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.jsonb('thirdPartyRatings').defaultTo(JSON.stringify({}));
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('thirdPartyRatings');
});
