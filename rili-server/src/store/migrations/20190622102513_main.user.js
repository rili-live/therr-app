exports.up = knex => knex.schema.createTable('main.users', (table) => {
    table.increments('id');
    table.string('user_name');
    table.string('first_name');
    table.string('last_name');
    table.string('password');
    table.string('phone_number').unique();
    table.timestamps(true, true);
});

exports.down = knex => knex.schema.dropTable('main.users');
