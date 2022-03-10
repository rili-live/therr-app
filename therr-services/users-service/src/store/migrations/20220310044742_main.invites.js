exports.up = (knex) => knex.schema.withSchema('main').createTable('invites', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(table.raw('uuid_generate_v4()'));
    table.uuid('requestingUserId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('email').unique().nullable();
    table.string('phoneNumber', 24).nullable();
    table.boolean('isAccepted').defaultTo(false);

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
});

exports.down = (knex) => knex.schema.dropTable('main.invites');
