exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.string('addressReadable');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('addressReadable');
});
