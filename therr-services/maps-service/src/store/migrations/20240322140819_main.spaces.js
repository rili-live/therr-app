exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.jsonb('medias');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('medias');
});
