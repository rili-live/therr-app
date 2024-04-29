exports.up = (knex) => knex.schema.withSchema('main').createTable('userInterests', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('userId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.uuid('interestId')
        .references('id')
        .inTable('main.userInterests')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.integer('score').notNullable(); // 1 - 5
    table.integer('engagementCount').notNullable().defaultTo(0); // 1 - 5

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('userId');
    table.index('interestId');
});

exports.down = (knex) => knex.schema.dropTable('main.userInterests');
