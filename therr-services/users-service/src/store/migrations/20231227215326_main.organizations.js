exports.up = (knex) => knex.schema.withSchema('main').alterTable('organizations', (table) => {
    table.string('domain').defaultTo('');

    table.index('domain');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('organizations', (table) => {
    table.dropColumn('domain');
});
