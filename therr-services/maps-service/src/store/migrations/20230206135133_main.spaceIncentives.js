exports.up = (knex) => knex.schema.withSchema('main').createTable('spaceIncentives', async (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('spaceId')
        .references('id')
        .inTable('main.spaces')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('incentiveKey').notNullable();
    table.double('incentiveValue').notNullable();
    table.string('incentiveRewardKey').notNullable();
    table.double('incentiveRewardValue').notNullable();
    table.string('incentiveCurrencyId').notNullable();
    table.boolean('isActive').notNullable().defaultTo(true);
    table.boolean('isFeatured').notNullable().defaultTo(false);
    table.integer('maxUseCount').notNullable().defaultTo(1);
    table.integer('minUserDataProps').notNullable().defaultTo(1);
    table.jsonb('requiredUserDataProps').notNullable().defaultTo(JSON.stringify([]));

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.string('region').notNullable(); // Also used for sharding, db location

    // Indexes
    table.index('id');
    table.unique(['spaceId', 'isFeatured']); // Only one featured incentive per space
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('spaceIncentives');
