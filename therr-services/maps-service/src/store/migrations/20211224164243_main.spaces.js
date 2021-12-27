exports.up = (knex) => knex.schema.withSchema('main').atlerTable('spaces', async (table) => {
    table.string('areaType', 25).notNullable().defaultsTo('spaces');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('areaType');
});
