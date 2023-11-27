exports.up = (knex) => knex.schema.withSchema('main').alterTable('campaigns', (table) => {
    table.dropColumn('businessSpaceIds');
    table.uuid('spaceId').nullable();
    // Indexes
    table.index('spaceId');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('campaigns', (table) => {
    table.jsonb('businessSpaceIds').notNullable().defaultsTo(JSON.stringify([])); // optional related spaces
    table.dropColumn('spaceId');
});
