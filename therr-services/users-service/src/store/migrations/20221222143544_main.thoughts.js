exports.up = (knex) => knex.schema.withSchema('main').createTable('thoughts', async (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('fromUserId').notNullable();
    table.uuid('parentId')
        .references('id')
        .inTable('main.thoughts')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('locale', 8);
    table.bool('isPublic').notNullable().defaultTo(false);
    table.bool('isRepost').notNullable().defaultTo(false);
    table.text('message').notNullable().defaultsTo('');
    table.text('mediaIds').notNullable().defaultsTo('');
    table.text('mentionsIds').notNullable().defaultsTo(''); // Other connection/user mentions for linking
    table.text('hashTags').notNullable().defaultsTo('');
    table.integer('maxViews').notNullable().defaultsTo(0);
    table.boolean('isMatureContent').notNullable().defaultTo(false);
    table.bool('isModeratorApproved').notNullable().defaultTo(false);
    table.bool('isForSale').notNullable().defaultTo(false);
    table.bool('isHirable').notNullable().defaultTo(false);
    table.bool('isPromotional').notNullable().defaultTo(false);
    table.bool('isExclusiveToGroups').notNullable().defaultTo(false);
    table.string('category', 50).notNullable().defaultTo('uncategorized');
    table.timestamp('isScheduledAt', { useTz: true });

    // Audit
    table.integer('valuation').notNullable().defaultTo(0);
    table.timestamp('expiresAt', { useTz: true });
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('parentId');
    table.index('createdAt');
});

exports.down = (knex) => knex.schema.withSchema('main').dropTable('thoughts');
