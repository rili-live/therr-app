exports.up = (knex) => knex.schema.withSchema('main').createTable('spaceMetrics', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('spaceId')
        .references('id')
        .inTable('main.spaces')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('region').notNullable(); // Duplicate property allows sharding
    table.string('name').notNullable();
    table.string('value').notNullable();
    table.string('valueType').notNullable(); // string, number, date, etc.
    table.uuid('userId');
    table.jsonb('dimensions').notNullable().defaultTo(JSON.stringify({}));

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('spaceId');
    table.index('name');
    table.index('userId');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('spaceMetrics');
