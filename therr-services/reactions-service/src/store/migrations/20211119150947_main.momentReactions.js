exports.up = (knex) => knex.schema.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    .then(() => knex.schema.raw('CREATE SCHEMA IF NOT EXISTS "main";'))
    .then(() => knex.schema.withSchema('main').createTable('momentReactions', (table) => {
        table.uuid('id').notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('momentId').notNullable();
        table.uuid('userId').notNullable();
        table.boolean('userHasActivated').notNullable().defaultTo(false);
        table.bool('userHasLiked').notNullable().defaultTo(false);
        table.bool('userHasSuperLiked').notNullable().defaultTo(false);
        table.bool('userHasDisliked').notNullable().defaultTo(false);
        table.bool('userHasSuperDisliked').notNullable().defaultTo(false);
        table.string('userLocale', 8);
        table.string('userBookmarkCategory');
        table.integer('userBookmarkPriority').notNullable().defaultTo(0);
        table.boolean('userHasReported').notNullable().defaultTo(false);
        table.boolean('isArchived').notNullable().defaultTo(false);

        // Audit
        table.integer('userViewCount').notNullable().defaultTo(0);
        table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

        // Indexes
        table.unique(['momentId', 'userId']);
        table.index(['momentId', 'userId']);
    }));

exports.down = (knex) => knex.schema.withSchema('main').dropTable('momentReactions');
