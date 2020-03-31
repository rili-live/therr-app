exports.up = (knex) => knex.schema.withSchema('main').createTable('users', (table) => {
    table.increments('id');
    table.jsonb('accessLevels').defaultTo(JSON.stringify(['user.default']));
    table.string('userName').unique().notNullable();
    table.string('email').unique().notNullable();
    table.string('firstName');
    table.string('lastName');
    table.string('password').notNullable();
    table.string('phoneNumber', 24).unique().notNullable();
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('users');
