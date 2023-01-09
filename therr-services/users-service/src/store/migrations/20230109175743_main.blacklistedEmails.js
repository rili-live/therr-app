exports.up = (knex) => knex.schema.withSchema('main').createTable('blacklistedEmails', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('email').notNullable();
    table.string('errorMessage').notNullable().defaultTo('');
    table.string('status').notNullable().defaultTo('blacklisted');

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.unique('email');
    table.index('email');
});

exports.down = (knex) => knex.schema.dropTable('main.blacklistedEmails');
