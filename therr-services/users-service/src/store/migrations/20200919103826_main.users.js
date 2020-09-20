exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.string('onTimePassword');
    table.jsonb('verificationCodes').defaultTo(JSON.stringify({ email: {}, mobile: {} }));
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('onTimePassword');
    table.dropColumn('verificationCodes');
});
