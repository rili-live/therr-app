exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.bool('isClaimPending').notNullable().defaultsTo(false); // Used to allow businesses to claim a space without providing location

    table.index('isClaimPending');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('isClaimPending');
});
