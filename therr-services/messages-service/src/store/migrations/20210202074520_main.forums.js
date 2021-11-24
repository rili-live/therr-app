exports.up = (knex) => knex.schema.withSchema('main').createTable('forums', (table) => {
    table.uuid('id').primary().notNullable()
        .defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('authorId');
    table.string('authorLocale').collate('utf8_general_ci').notNullable();
    table.string('title').collate('utf8_general_ci').notNullable();
    table.string('subtitle').collate('utf8_general_ci').notNullable();
    table.text('description').collate('utf8_general_ci').notNullable();
    table.text('administratorIds').notNullable().defaultsTo(''); // comma separated list
    table.text('hashTags').notNullable().defaultsTo('');
    table.text('integrationIds').notNullable().defaultsTo(''); // comma separated list
    table.text('invitees').notNullable().defaultsTo(''); // comma separated list
    table.string('iconGroup').notNullable();
    table.string('iconId', 50).notNullable();
    table.string('iconColor', 40).notNullable();
    table.bool('doesExpire').notNullable().defaultTo(true);
    table.bool('isPublic').notNullable().defaultTo(false);

    // Audit
    table.integer('maxCommentsPerMin').notNullable().defaultsTo(50);
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('id').index('authorId');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('forums');
