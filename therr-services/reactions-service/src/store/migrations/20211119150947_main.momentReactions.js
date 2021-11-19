exports.up = (knex) => knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    .then(() => knex.schema.withSchema('main').alterTable('momentReactions', (table) => {
        table.uuid('momentUUID').notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('userUUID').notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
        table.boolean('isArchived').notNullable().defaultTo(false);
        table.primary(['momentUUID', 'userUUID']);
    }));

exports.down = (knex) => knex.schema.withSchema('main').alterTable('momentReactions', (table) => {
    table.dropPrimary();
    table.dropColumn('momentUUID');
    table.dropColumn('userUUID');
    table.dropColumn('isArchived');
});
