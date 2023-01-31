exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', async (table) => {
    table.uuid('spaceId')
        .references('id')
        .inTable('main.spaces')
        .onUpdate('CASCADE');

    table.index('spaceId');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropColumn('spaceId');
});
