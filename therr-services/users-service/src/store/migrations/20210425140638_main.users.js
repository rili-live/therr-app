exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.varchar('deviceMobileFirebaseToken').notNullable().defaultsTo('');
    table.integer('loginCount').notNullable().defaultsTo(0);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('deviceMobileFirebaseToken');
    table.dropColumn('loginCount');
});
