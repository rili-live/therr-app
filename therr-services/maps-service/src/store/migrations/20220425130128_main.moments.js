exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', async (table) => {
    table.bool('isDraft').notNullable().defaultTo(false);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropColumn('isDraft');
});
