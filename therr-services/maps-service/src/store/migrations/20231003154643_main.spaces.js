exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.integer('priceRange').defaultTo(2); // 1-5, 5 is the highest
    table.string('foodStyle'); // italian, mexican, etc.
    table.jsonb('openingHours').defaultTo(JSON.stringify({
        schema: ['Mo-Su 09:00-20:00'],
        timezone: 'CDT',
        isConfirmed: false,
    }));
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('priceRange');
    table.dropColumn('foodStyle');
    table.dropColumn('openingHours');
});
