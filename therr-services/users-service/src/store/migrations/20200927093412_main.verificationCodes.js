exports.up = (knex) => knex.schema.withSchema('main').alterTable('verificationCodes', (table) => {
    table.bigInteger('msExpiresAt').notNullable().defaultsTo(knex.raw('(extract(epoch from now()) * 1000) + (1000 * 60 * 60 * 24)')).alter(); // epoch + 1 day
});

exports.down = (knex) => Promise.resolve();
