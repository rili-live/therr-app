exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaceIncentives', async (table) => {
    table.timestamp('startsAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('endsAt', { useTz: true });

    // Indexes
    table.index('startsAt');
    table.index('endsAt');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaceIncentives', (table) => {
    table.dropColumn('startsAt');
    table.dropColumn('endsAt');
});
