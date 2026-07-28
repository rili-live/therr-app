exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.string('areaType', 25).notNullable().defaultsTo('moments');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropColumn('areaType');
});
