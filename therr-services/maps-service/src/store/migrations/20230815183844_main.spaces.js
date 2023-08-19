exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.bool('isPointOfInterest').notNullable().defaultTo(true);
    table.string('businessTransactionId').nullable();
    table.string('businessTransactionName').nullable();
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('isPointOfInterest');
    table.dropColumn('businessTransactionId');
    table.dropColumn('businessTransactionName');
});
