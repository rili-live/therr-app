exports.up = (knex) => knex.schema.withSchema('main')
    .alterTable('momentStats', (table) => table.uuid('uuid').notNullable().defaultTo(knex.raw('uuid_generate_v4()')));

exports.down = (knex) => knex.schema.withSchema('main').alterTable('momentStats', (table) => {
    table.dropColumn('uuid');
});
