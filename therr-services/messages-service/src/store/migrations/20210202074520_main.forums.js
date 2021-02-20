exports.up = (knex) => knex.schema.withSchema('main').createTable('forums', (table) => {
    table.increments('id');
    table.integer('authorId');
    table.string('authorLocale').notNullable();
    table.string('title').notNullable();
    table.string('subtitle').notNullable();
    table.text('description').notNullable();
    table.text('administratorIds').notNullable().defaultsTo(''); // comma separated list
    table.text('hashTags').notNullable().defaultsTo('');
    table.text('integrationIds').notNullable().defaultsTo(''); // comma separated list
    table.text('invitees').notNullable().defaultsTo(''); // comma separated list
    table.string('iconGroup').notNullable();
    table.string('iconId', 50).notNullable();
    table.string('iconColor', 40).notNullable();
    table.integer('maxCommentsPerMin').notNullable().defaultsTo(50);

    table.bool('doesExpire').notNullable().defaultTo(true);
    table.bool('isPublic').notNullable().defaultTo(false);

    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index('id').index('authorId');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('forums');
