exports.up = (knex) => knex.schema.withSchema('main').createTable('verificationCodes', (table) => {
    table.increments('id');
    table.string('code', 36).unique().notNullable();
    table.enu('type', ['email', 'mobile']).notNullable();
    table.bigInteger('msExpiresAt').notNullable().defaultsTo(Date.now() + (1000 * 60 * 60 * 24));
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index('id').index('code');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('verificationCodes');
