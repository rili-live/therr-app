exports.up = (knex) => knex.schema.withSchema('main').alterTable('momentReactions', (table) => {
    table.boolean('userHasReported').notNullable().defaultTo(false);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('momentReactions', (table) => {
    table.dropColumn('userHasReported');
});
