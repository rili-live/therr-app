exports.up = (knex) => knex.schema.withSchema('main').alterTable('events', (table) => {
    table.jsonb('medias');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('events', (table) => {
    table.dropColumn('medias');
});
