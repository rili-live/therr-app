exports.up = (knex) => knex.schema.withSchema('main').alterTable('socialSyncs', (table) => {
    table.string('platformUserId').notNullable().alter();
    table.unique(['userId', 'platformUserId']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('socialSyncs', (table) => {
    table.string('platformUserId').nullable().alter();
    table.dropUnique(['userId', 'groupId']);
});
