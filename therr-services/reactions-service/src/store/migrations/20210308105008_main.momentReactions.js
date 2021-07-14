exports.up = (knex) => knex.schema.withSchema('main').createTable('momentReactions', (table) => {
    table.integer('momentId');
    table.integer('userId');
    table.integer('userViewCount').notNullable().defaultTo(0);
    table.boolean('userHasActivated').notNullable().defaultTo(false);
    table.bool('userHasLiked').notNullable().defaultTo(false);
    table.bool('userHasSuperLiked').notNullable().defaultTo(false);
    table.bool('userHasDisliked').notNullable().defaultTo(false);
    table.bool('userHasSuperDisliked').notNullable().defaultTo(false);
    table.string('userLocale', 8);
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['momentId', 'userId']);
    table.index('momentId').index(['momentId', 'userId']);
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('momentReactions');
