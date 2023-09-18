exports.up = (knex) => knex.schema.withSchema('main').createTable('organizations', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('creatorId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description');

    // Audit
    table.timestamp('createdAt', {
        useTz: true,
    }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', {
        useTz: true,
    }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('creatorId');
});

exports.down = (knex) => knex.schema.dropTable('main.organizations');
