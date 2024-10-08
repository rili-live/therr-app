/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = (knex) => knex.schema.withSchema('main').createTable('userLocations', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('userId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.boolean('isDeclaredHome').notNullable().defaultTo(false);
    table.double('latitude', 15).nullable();
    table.double('longitude', 15).nullable();
    table.double('latitudeRounded', 12).nullable();
    table.double('longitudeRounded', 12).nullable();

    // Audit
    table.integer('visitCount').notNullable().defaultTo(1);
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.unique(['userId', 'latitudeRounded', 'longitudeRounded']);
    table.index(['userId', 'visitCount']);
});

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = (knex) => knex.schema.dropTable('main.userLocations');
