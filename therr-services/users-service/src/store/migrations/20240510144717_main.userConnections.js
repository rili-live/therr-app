exports.up = (knex) => knex.schema.withSchema('main').alterTable('userConnections', (table) => {
    table.integer('type').notNullable().defaultsTo(1); // ex. 1 = stranger, 2 = connection, 3 = friends, 4 = family, 5 = close friend, etc
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('userConnections', (table) => {
    table.dropColumn('type');
});
