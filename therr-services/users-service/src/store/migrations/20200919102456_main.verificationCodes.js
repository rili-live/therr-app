exports.up = (knex) => knex.schema.withSchema('main').createTable('verificationCodes', (table) => {
    table.increments('id');
    table.string('code', 36).unique().notNullable();
    table.enu('type', ['email', 'mobile']).notNullable();
    table.bigInteger('msExpiresAt').defaultsTo(Date.now() + (1000 * 60 * 60 * 24)); // One day from creation (epoch)
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index('id').index('code');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('verificationCodes');
