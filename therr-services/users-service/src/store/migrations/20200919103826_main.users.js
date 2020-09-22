exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.string('oneTimePassword');
    table.jsonb('verificationCodes').defaultTo(JSON.stringify({ email: {}, mobile: {} }));
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('oneTimePassword');
    table.dropColumn('verificationCodes');
});
