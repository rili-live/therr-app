exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', async (table) => {
    table.jsonb('interestsKeys').notNullable().defaultTo(JSON.stringify([]));

    table.index('interestsKeys', 'idx_moments_interests_keys', {
        indexType: 'GIN',
    });
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropColumn('interestsKeys');
});
