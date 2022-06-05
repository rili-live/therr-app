exports.up = (knex) => knex.schema.withSchema('main').createTable('externalMediaIntegrations', async (table) => {
    table.uuid('id').notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('fromUserId').notNullable();
    table.uuid('momentId')
        .references('id')
        .inTable('main.moments')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('externalId').notNullable();
    table.string('platform').notNullable();
    table.string('permalink').nullable();
    table.integer('priority').notNullable().defaultTo(1);
    table.integer('weight').notNullable().defaultTo(1);

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('fromUserId');
    table.index('momentId');
    table.unique(['externalId', 'platform']);
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('externalMediaIntegrations');
