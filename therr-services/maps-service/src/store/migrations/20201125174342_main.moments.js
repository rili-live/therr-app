exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.float('minProximity').defaultTo(50.0);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropColumn('minProximity');
});
