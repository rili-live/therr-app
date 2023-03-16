exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', async (table) => {
    await table.dropForeign('spaceid');
    table.uuid('spaceId')
        .alter()
        .references('id')
        .inTable('main.spaces')
        .onDelete('SET NULL');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', async (table) => {
    // await table.dropForeign('spaceid');
    table.uuid('spaceId')
        .alter()
        .references('id')
        .inTable('main.spaces')
        .onDelete('NO ACTION');
});
