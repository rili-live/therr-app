exports.up = (knex) => knex.schema.withSchema('main').createTable('emailMarketingSubscribers', (table) => {
    table.increments('id');
    table.string('email').unique().notNullable();
    table.boolean('isSubscribedToInfo').notNullable().defaultTo(true);
    table.boolean('isSubscribedToNews').notNullable().defaultTo(true);
    table.boolean('isSubscribedToMarketing').notNullable().defaultTo(true);
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('emailMarketingSubscribers');
