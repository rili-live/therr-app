exports.up = (knex) => knex.schema.withSchema('main').createTable('moments', (table) => {
    table.increments('id').primary().notNullable();
    table.integer('fromUserId').notNullable();
    table.string('locale', 8);
    table.bool('isPublic').notNullable().defaultTo(false);
    table.text('message').notNullable().defaultsTo('');
    table.string('notificationMsg').notNullable(); // If empty, should default to first x characters of message
    table.text('mediaIds').notNullable().defaultsTo('');
    table.text('mentionsIds').notNullable().defaultsTo(''); // Other connection/user mentions for linking
    table.text('hashTags').notNullable().defaultsTo('');
    table.integer('maxViews').notNullable().defaultsTo(0);
    table.string('latitude').notNullable();
    table.string('longitude').notNullable();
    table.string('radius');
    table.jsonb('polygonCoords').notNullable().defaultsTo(JSON.stringify([]));

    // audit
    table.string('region').notNullable(); // Also used for sharding, db locationing
    table.timestamp('expiresAt', { useTz: true });
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index('id');
    table.index('fromUserId');
    table.index('isPublic');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('moments');
