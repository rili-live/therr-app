exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.jsonb('verificationCodes').defaultTo(JSON.stringify([{}]));
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('verificationCodes');
});
