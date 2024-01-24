exports.up = (knex) => knex.schema.withSchema('main').alterTable('forumMessages', (table) => {
    table.bool('isAnnouncement', 15).notNullable().defaultsTo(false);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('forumMessages', (table) => {
    table.dropColumn('isAnnouncement');
});
