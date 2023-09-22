exports.up = (knex) => knex.schema.withSchema('main').alterTable('campaignAssets', (table) => {
    table.dropColumn('campaignId');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('campaignAssets', (table) => {
    table.uuid('campaignId')
        .nullable()
        .references('id')
        .inTable('main.campaigns')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
});
