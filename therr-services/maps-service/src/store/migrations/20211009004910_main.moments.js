exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.boolean('isMatureContent').notNullable().defaultTo(false);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropColumn('isMatureContent');
});
