exports.up = (knex) => knex.schema.withSchema('main').alterTable('verificationCodes', (table) => {
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('verificationCodes', (table) => {
    table.dropColumn('updatedAt');
});
