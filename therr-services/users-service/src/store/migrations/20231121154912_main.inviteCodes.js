exports.up = (knex) => knex.schema.withSchema('main').createTable('inviteCodes', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('code').unique().nullable();
    table.string('redemptionType').notNullable().defaultTo('basic-subscription');
    table.string('userEmail');
    table.string('partner');
    table.boolean('isRedeemed').defaultTo(false);

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index('code').index(['code', 'userEmail']);
});

exports.down = (knex) => knex.schema.dropTable('main.inviteCodes');
