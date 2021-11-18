exports.up = (knex) => knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    .then(() => knex.schema.withSchema('main').alterTable('media', (table) => {
        table.dropPrimary();
        table.uuid('uuid').primary().notNullable()
            .defaultTo(knex.raw('uuid_generate_v4()'));
    }));

exports.down = (knex) => knex.schema.withSchema('main').alterTable('media', (table) => {
    table.dropPrimary();
    table.primary('id');
    table.dropColumn('uuid');
});
