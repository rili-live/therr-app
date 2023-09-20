exports.up = (knex) => knex.schema.withSchema('main').alterTable('campaigns', (table) => {
    table.jsonb('integrationTargets').defaultTo(JSON.stringify(['therr-rewards']));
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('campaigns', (table) => {
    table.dropColumn('integrationTargets');
});
