exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.jsonb('media').defaultTo(JSON.stringify({}));
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('media');
});
