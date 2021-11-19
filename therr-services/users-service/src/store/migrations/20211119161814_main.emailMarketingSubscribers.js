exports.up = (knex) => knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    .then(() => knex.schema.withSchema('main').createTable('emailMarketingSubscribers', (table) => {
        table.uuid('id').primary().notNullable()
            .defaultTo(knex.raw('uuid_generate_v4()'));
        table.string('email').unique().notNullable();
        table.boolean('isSubscribedToInfo').notNullable().defaultTo(true);
        table.boolean('isSubscribedToNews').notNullable().defaultTo(true);
        table.boolean('isSubscribedToMarketing').notNullable().defaultTo(true);
        table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    }));

exports.down = (knex) => knex.schema.withSchema('main').dropTable('emailMarketingSubscribers');
