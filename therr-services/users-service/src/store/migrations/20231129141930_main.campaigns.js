exports.up = (knex) => knex.schema.withSchema('main').alterTable('campaigns', (table) => {
    table.dropColumn('assetIds');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('campaigns', (table) => {
    table.jsonb('assetIds').notNullable().defaultsTo(JSON.stringify([]));
});
