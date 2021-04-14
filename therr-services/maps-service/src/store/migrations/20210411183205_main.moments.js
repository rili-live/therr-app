exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.bool('doesRequireProximityToView').notNullable().defaultTo(false);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropColumn('doesRequireProximityToView');
});
