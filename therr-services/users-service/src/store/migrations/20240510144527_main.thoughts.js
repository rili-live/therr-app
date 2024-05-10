exports.up = (knex) => knex.schema.withSchema('main').alterTable('thoughts', async (table) => {
    table.jsonb('interestsKeys').notNullable().defaultTo(JSON.stringify([]));

    table.index('interestsKeys', 'idx_thoughts_interests_keys', {
        indexType: 'GIN',
    });
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('thoughts', (table) => {
    table.dropColumn('interestsKeys');
});
