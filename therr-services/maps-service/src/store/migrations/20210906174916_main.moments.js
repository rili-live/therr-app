exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.integer('valuation').notNullable().defaultTo(0);

    table.index('valuation');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropColumn('valuation');
});
