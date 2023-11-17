exports.up = (knex) => knex.schema.withSchema('main').alterTable('organizations', (table) => {
    table.string('settingsGeneralBusinessType').notNullable().defaultTo('small-business');
    table.string('businessIndustry').notNullable().defaultTo('restaurant-services');
    table.boolean('isAgency').notNullable().defaultTo(false);
});

exports.down = (knex) => knex.schema.withSchema('main').alterTable('organizations', (table) => {
    table.dropColumn('settingsGeneralBusinessType');
    table.dropColumn('businessIndustry');
    table.dropColumn('isAgency');
});
