exports.up = knex => knex.schema.createTable('main.users', (table) => {
    table.increments('id');
    table.jsonb('accessLevels').defaultTo(JSON.stringify(['user.default']));
    table.string('userName').unique().notNullable();
    table.string('email').unique().notNullable();
    table.string('firstName');
    table.string('lastName');
    table.string('password').notNullable();
    table.string('phoneNumber').unique().notNullable();
    table.timestamps(true, true);
});

exports.down = knex => knex.schema.dropTable('main.users');
