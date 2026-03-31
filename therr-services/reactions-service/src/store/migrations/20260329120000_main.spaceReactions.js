exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaceReactions', (table) => {
    table.timestamp('visitedAt', { useTz: true }).nullable();
    table.timestamp('lastVisitedAt', { useTz: true }).nullable();
    table.integer('visitCount').notNullable().defaultTo(0);
    table.index(['userId', 'lastVisitedAt'], 'idx_spacereactions_userid_lastvisitedat');
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaceReactions', (table) => {
    table.dropIndex(['userId', 'lastVisitedAt'], 'idx_spacereactions_userid_lastvisitedat');
    table.dropColumn('visitedAt');
    table.dropColumn('lastVisitedAt');
    table.dropColumn('visitCount');
});
