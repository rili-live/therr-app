exports.up = (knex) => knex.schema.withSchema('main').alterTable('forums', (table) => {
    table.string('city', 100).nullable();
    table.string('region', 100).nullable();
    table.string('country', 100).nullable();
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('forums', (table) => {
    table.dropColumn('city');
    table.dropColumn('region');
    table.dropColumn('country');
});
