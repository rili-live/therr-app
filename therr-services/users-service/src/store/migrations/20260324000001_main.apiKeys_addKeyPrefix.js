exports.up = (knex) => knex.schema.withSchema('main').alterTable('apiKeys', (table) => {
    table.string('keyPrefix', 8).notNullable().defaultTo('');
    table.string('name', 128).nullable();

    table.unique('keyPrefix');
    table.index('keyPrefix');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('apiKeys', (table) => {
    table.dropIndex('keyPrefix');
    table.dropUnique(['keyPrefix']);
    table.dropColumn('keyPrefix');
    table.dropColumn('name');
});
