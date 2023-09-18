exports.up = (knex) => knex.schema.withSchema('main').createTable('userOrganizations', (table) => {
    table.uuid('organizationId')
        .references('id')
        .inTable('main.organizations')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.uuid('userId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('inviteStatus').notNullable();
    table.bool('isEnabled').notNullable().defaultTo(true);

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.unique(['organizationId', 'userId']);
    table.index(['organizationId', 'userId']);
});

exports.down = (knex) => knex.schema.dropTable('main.userOrganizations');
