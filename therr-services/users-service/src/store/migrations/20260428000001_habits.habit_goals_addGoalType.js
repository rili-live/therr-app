exports.up = (knex) => knex.schema.withSchema('habits').alterTable('habit_goals', (table) => {
    // build_good | break_bad | savings_goal | maintenance
    table.string('goalType', 20).notNullable().defaultTo('build_good');
    table.index('goalType');
});

exports.down = (knex) => knex.schema.withSchema('habits').alterTable('habit_goals', (table) => {
    table.dropIndex('goalType');
    table.dropColumn('goalType');
});
