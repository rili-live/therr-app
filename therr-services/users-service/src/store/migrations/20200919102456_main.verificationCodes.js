exports.up = (knex) => knex.schema.withSchema('main').createTable('verificationCodes', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('code', 36).unique().notNullable();
    table.enu('type', ['email', 'mobile']).notNullable();

    // Audit
    table.bigInteger('msExpiresAt').notNullable().defaultsTo(knex.raw('(extract(epoch from now()) * 1000) + (1000 * 60 * 60 * 24)'));
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index('id').index('code');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('verificationCodes');
