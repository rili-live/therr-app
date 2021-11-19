exports.up = (knex) => knex.schema.withSchema('main').createTable('userResources', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('userId')
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

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('userId');
});

exports.down = (knex) => knex.schema.dropTable('main.userResources');
