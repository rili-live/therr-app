exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.bool('isModeratorApproved').notNullable().defaultTo(false);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropColumn('isModeratorApproved');
});
