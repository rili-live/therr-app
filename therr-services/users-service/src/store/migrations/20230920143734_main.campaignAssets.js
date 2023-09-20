exports.up = (knex) => knex.schema.withSchema('main').createTable('campaignAssets', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('creatorId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.uuid('campaignId')
        .nullable()
        .references('id')
        .inTable('main.campaigns')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.uuid('organizationId')
        .nullable()
        .references('id')
        .inTable('main.organizations')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.uuid('mediaId'); // if type is image or video
    table.uuid('spaceId'); // if type is space
    table.string('status').notNullable(); // processing and AI status (accepted, optimized, rejected, etc.)
    table.string('type').notNullable(); // text, image, video, space, etc.
    table.string('performance').notNullable(); // performance rating (worst, bad, learning, good, best)
    table.string('headline'); // if type is text
    table.string('longText'); // if type is text

    // Audit
    table.integer('clicks').notNullable().defaultTo(0);
    table.integer('impressions').notNullable().defaultTo(0);
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('creatorId').index('campaignId').index('organizationId');
});

exports.down = (knex) => knex.schema.dropTable('main.campaignAssets');
