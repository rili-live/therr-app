exports.up = (knex) => knex.schema.withSchema('main').createTable('userMetrics', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('userId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('region'); // Optional convenience property for filtering metrics
    table.double('latitude', 15);
    table.double('longitude', 15);
    table.string('name').notNullable();
    table.string('value').notNullable();
    table.string('valueType').notNullable(); // string, number, date, etc.
    table.uuid('contentUserId');
    table.jsonb('dimensions').notNullable().defaultTo(JSON.stringify({}));

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('userId');
    table.index('contentUserId');
    table.index(['userId', 'createdAt']);
    table.index(['userId', 'name']);
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('userMetrics');
