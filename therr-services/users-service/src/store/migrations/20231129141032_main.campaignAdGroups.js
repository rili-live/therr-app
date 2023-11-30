exports.up = (knex) => knex.schema.withSchema('main').createTable('campaignAdGroups', (table) => {
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
    table.jsonb('assetIds').notNullable().defaultTo(JSON.stringify([]));
    table.uuid('spaceId'); // if type is space
    table.string('status').notNullable(); // processing and AI status (accepted, optimized, rejected, etc.)
    table.string('performance').notNullable(); // performance rating (worst, bad, learning, good, best)
    table.string('headline');
    table.string('description');
    table.string('goal').notNullable().defaultTo('clicks');
    table.string('linkUrl');
    table.string('urlParams');
    table.jsonb('audiences').notNullable().defaultTo(JSON.stringify([])); // connection to integration third-party IDs
    table.jsonb('integrationAssociations').notNullable().defaultTo(JSON.stringify({})); // connection to integration third-party IDs
    table.jsonb('languages').defaultTo(JSON.stringify(['en-us']));
    table.timestamp('scheduleStartAt', {
        useTz: true,
    }).notNullable();
    table.timestamp('scheduleStopAt', {
        useTz: true,
    }).notNullable();

    // Audit
    table.integer('clicks').notNullable().defaultTo(0);
    table.integer('impressions').notNullable().defaultTo(0);
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('creatorId').index('campaignId').index('organizationId').index(['scheduleStartAt', 'scheduleStopAt']);
});

exports.down = (knex) => knex.schema.dropTable('main.campaignAdGroups');
