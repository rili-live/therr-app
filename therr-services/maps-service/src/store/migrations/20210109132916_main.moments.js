exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.float('minProximity').defaultTo(0.0).alter();
    table.renameColumn('minProximity', 'maxProximity');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.float('maxProximity').defaultTo(50.0).alter();
    table.renameColumn('maxProximity', 'minProximity');
});
