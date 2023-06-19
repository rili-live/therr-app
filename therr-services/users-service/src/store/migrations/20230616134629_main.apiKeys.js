exports.up = (knex) => knex.schema.withSchema('main').createTable('apiKeys', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('userId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.jsonb('accessLevels').defaultTo(JSON.stringify(['user.default']));
    table.string('hashedKey').notNullable(); // string, number, date, etc.
    table.bool('isValid').notNullable().defaultTo(true); // Change this to false after a user is blocked/deleted/etc.

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('lastAccessed', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('userId');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('apiKeys');
