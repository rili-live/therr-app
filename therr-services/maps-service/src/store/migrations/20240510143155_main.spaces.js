exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.jsonb('interestsKeys').notNullable().defaultTo(JSON.stringify([]));

    table.index('interestsKeys', 'idx_spaces_interests_keys', {
        indexType: 'GIN',
    });
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('interestsKeys');
});
