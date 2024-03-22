exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', async (table) => {
    table.jsonb('medias');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropColumn('medias');
});
