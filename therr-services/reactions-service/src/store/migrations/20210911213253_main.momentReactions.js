exports.up = (knex) => knex.schema.withSchema('main').alterTable('momentReactions', (table) => {
    table.string('userBookmarkCategory');
    table.number('userBookmarkPriority').notNullable().defaultTo(0);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('momentReactions', (table) => {
    table.dropColumn('userBookmarkCategory');
    table.dropColumn('userBookmarkPriority');
});
