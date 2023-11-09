exports.up = (knex) => knex.schema.withSchema('main').alterTable('campaigns', (table) => {
    table.jsonb('integrationDetails').defaultTo(JSON.stringify({}));
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('campaigns', (table) => {
    table.dropColumn('integrationDetails');
});
