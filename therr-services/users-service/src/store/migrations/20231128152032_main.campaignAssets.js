exports.up = (knex) => knex.schema.withSchema('main').alterTable('campaignAssets', (table) => {
    table.string('goal').notNullable().defaultTo('clicks');
    table.string('linkUrl');
    table.string('urlParams');
    table.jsonb('audiences').notNullable().defaultTo(JSON.stringify([])); // connection to integration third-party IDs
    table.jsonb('languages').defaultTo(JSON.stringify(['en-us']));
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('campaignAssets', (table) => {
    table.dropColumn('goal');
    table.dropColumn('linkUrl');
    table.dropColumn('urlParams');
    table.dropColumn('audiences');
    table.dropColumn('languages');
});
