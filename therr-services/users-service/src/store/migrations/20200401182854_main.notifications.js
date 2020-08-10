exports.up = (knex) => knex.schema.withSchema('main').alterTable('notifications', (table) => {
    table.string('message').notNullable().alter();
    table.renameColumn('message', 'messageLocaleKey');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('notifications', (table) => {
    table.string('messageLocaleKey').nullable().alter();
    table.renameColumn('messageLocaleKey', 'message');
});
