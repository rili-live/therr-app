exports.up = (knex) => knex.schema.withSchema('main').createTable('spaceIncentiveCoupons', async (table) => {
    table.uuid('spaceIncentiveId')
        .references('id')
        .inTable('main.spaceIncentives')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.uuid('userId').notNullable();
    table.integer('useCount').notNullable().defaultTo(0);
    table.jsonb('requiredUserDataProps').notNullable().defaultTo(JSON.stringify([]));
    table.timestamp('expirationDate', { useTz: true });

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.string('region').notNullable(); // Also used for sharding, db location

    // Indexes
    table.index(['spaceIncentiveId', 'userId']);
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('spaceIncentiveCoupons');
