exports.up = (knex) => knex.schema.withSchema('main').createTable('userResources', (table) => {
    table.increments('id');
    table.integer('userId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.integer('solar').notNullable().defaultTo(0);
    table.integer('wind').notNullable().defaultTo(0);
    table.integer('hydroElectric').notNullable().defaultTo(0);
    table.integer('geoThermal').notNullable().defaultTo(0);
    table.integer('ocean').notNullable().defaultTo(0);
    table.integer('hydrogen').notNullable().defaultTo(0);
    table.integer('bioMass').notNullable().defaultTo(0);
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index('userId');
});

exports.down = (knex) => knex.schema.dropTable('main.userResources');
