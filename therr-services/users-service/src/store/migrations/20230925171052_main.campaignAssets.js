exports.up = (knex) => knex.schema.withSchema('main').alterTable('campaignAssets', (table) => {
    table.dropColumn('mediaId');
    table.jsonb('media').defaultTo(JSON.stringify({})); // if type is image or video
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('campaignAssets', (table) => {
    table.uuid('mediaId');
    table.dropColumn('media');
});
