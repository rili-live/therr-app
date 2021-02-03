exports.up = (knex) => knex.schema.withSchema('main').createTable('integrations', (table) => {
    table.increments('id');
    table.string('name').notNullable();
    table.string('tag').notNullable();
    table.jsonb('config').notNullable().defaultsTo(JSON.stringify({}));
    table.string('iconGroup').notNullable();
    table.string('iconId', 50).notNullable();
    table.string('iconColor', 40).notNullable();

    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index('id');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('integrations');
