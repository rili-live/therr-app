exports.up = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.text('userAdministratorForumIds');
    table.text('userInvitedForumIds');
    table.text('userRecentForumIds');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('users', (table) => {
    table.dropColumn('userAdministratorForumIds');
    table.dropColumn('userInvitedForumIds');
    table.dropColumn('userRecentForumIds');
});
