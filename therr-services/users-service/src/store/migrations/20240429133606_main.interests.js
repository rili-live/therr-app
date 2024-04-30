exports.up = (knex) => knex.schema.withSchema('main').createTable('interests', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('tag').unique().notNullable();
    table.string('categoryKey').notNullable();
    table.string('displayNameKey').notNullable();
    table.string('emoji').notNullable();
    table.string('iconGroup').notNullable();
    table.string('iconId', 50).notNullable();
    table.string('iconColor', 40).notNullable();

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('tag');
    table.index('categoryKey');
});

exports.down = (knex) => knex.schema.dropTable('main.interests');
