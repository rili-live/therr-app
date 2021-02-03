exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.text('userAdministratorForumIds').notNullable().defaultsTo('');
    table.text('userInvitedForumIds').notNullable().defaultsTo('');
    table.text('userRecentForumIds').notNullable().defaultsTo('');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('userAdministratorForumIds');
    table.dropColumn('userInvitedForumIds');
    table.dropColumn('userRecentForumIds');
});
