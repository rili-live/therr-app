exports.up = (knex) => knex.schema.withSchema('main').alterTable('momentStats', (table) => { // remove cascade
    table.dropForeign('momentid');
}).then(() => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropPrimary();
    table.uuid('uuid').primary().notNullable()
        .defaultTo(knex.raw('uuid_generate_v4()'));
}));

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropPrimary();
    table.primary('id');
    table.dropColumn('uuid');
}).then(() => knex.schema.withSchema('main').alterTable('momentStats', (table) => { // remove cascade
    table.integer('momentId')
        .references('id')
        .inTable('main.moments')
        .onUpdate('CASCADE')
        .onDelete('CASCADE')
        .alter();
}));
