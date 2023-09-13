exports.up = (knex) => knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    .then(() => knex.schema.raw('CREATE SCHEMA IF NOT EXISTS "main";'))
    .then(() => knex.schema.withSchema('main').createTable('directMessages', (table) => {
        table.uuid('id').primary().notNullable()
            .defaultTo(knex.raw('uuid_generate_v4()'));
        table.text('message').notNullable();
        table.uuid('toUserId').notNullable();
        table.uuid('fromUserId').notNullable();
        table.bool('isUnread').notNullable().defaultTo(true);
        table.string('locale', 8);

        // Audit
        table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

        // Indexes
        table.index(['toUserId', 'fromUserId']);
    }));

exports.down = (knex) => knex.schema.withSchema('main').dropTable('directMessages');
