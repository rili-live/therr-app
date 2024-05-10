exports.up = (knex) => knex.schema.withSchema('main').alterTable('events', async (table) => {
    table.jsonb('interestsKeys').notNullable().defaultTo(JSON.stringify([]));

    table.index('interestsKeys', 'idx_events_interests_keys', {
        indexType: 'GIN',
    });
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('events', (table) => {
    table.dropColumn('interestsKeys');
});
