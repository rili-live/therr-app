exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaces', async (table) => {
    table.string('phoneNumber', 24).nullable();
    table.string('websiteUrl').nullable();
    table.string('menuUrl').nullable();
    table.string('orderUrl').nullable();
    table.string('reservationUrl').nullable();
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaces', (table) => {
    table.dropColumn('phoneNumber');
    table.dropColumn('websiteUrl');
    table.dropColumn('menuUrl');
    table.dropColumn('orderUrl');
    table.dropColumn('reservationUrl');
});
