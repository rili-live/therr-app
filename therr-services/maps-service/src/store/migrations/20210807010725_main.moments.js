exports.up = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.bool('isForSale').notNullable().defaultTo(false);
    table.bool('isHirable').notNullable().defaultTo(false);
    table.bool('isPromotional').notNullable().defaultTo(false);
    table.bool('isExclusiveToGroups').notNullable().defaultTo(false);
    table.string('category', 50).notNullable().defaultTo('uncategorized');
    table.timestamp('isScheduledAt', { useTz: true });
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('moments', (table) => {
    table.dropColumn('isForSale');
    table.dropColumn('isHirable');
    table.dropColumn('isPromotional');
    table.dropColumn('isExclusiveToGroups');
    table.dropColumn('category');
    table.dropColumn('isScheduledAt', { useTz: true });
});
