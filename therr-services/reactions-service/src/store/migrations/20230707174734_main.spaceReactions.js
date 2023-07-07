exports.up = (knex) => knex.schema.withSchema('main').alterTable('spaceReactions', (table) => {
    table.integer('rating');

    // Indexes
    table.index(['spaceId', 'rating']);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('spaceReactions', (table) => {
    table.dropColumn('rating');
});
