exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.string('userName').nullable().alter();
    table.string('phoneNumber', 24).nullable().alter();
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.string('userName').notNullable().alter();
    table.string('phoneNumber', 24).notNullable().alter();
});
