exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.bool('hasAgreedToTerms').nullable().defaultsTo(false);
    table.bool('isBlocked').nullable().defaultsTo(false);
    table.jsonb('blockedUsers').defaultTo(JSON.stringify([]));
    table.jsonb('wasReportedBy').defaultTo(JSON.stringify([]));
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('hasAgreedToTerms');
    table.dropColumn('isBlocked');
    table.dropColumn('blockedUsers');
    table.dropColumn('wasReportedBy');
});
