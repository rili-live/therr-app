exports.up = (knex) => knex.schema.withSchema('main').createTable('momentStats', (table) => {
    table.uuid('momentId')
        .references('id')
        .inTable('main.moments')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('region').notNullable(); // Duplicate property allows sharding
    table.text('viewerIds').notNullable().defaultTo('');
    table.integer('viewCount').notNullable().defaultTo(0);
    table.integer('averageViewTimeSeconds').notNullable().defaultTo(0);

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('momentId');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('momentStats');
