exports.up = (knex) => knex.schema.withSchema('main').createTable('campaigns', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('creatorId')
        .references('id')
        .inTable('main.users')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.uuid('organizationId')
        .nullable()
        .references('id')
        .inTable('main.organizations')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
    table.string('title').notNullable();
    table.text('description').notNullable();
    table.jsonb('assetIds').notNullable().defaultsTo(JSON.stringify([])); // campaignAssets.id, headlines, descriptions, media, etc.
    table.string('status').notNullable(); // active, paused, removed, etc.
    table.string('type').notNullable().defaultsTo('local'); // local, awareness, acquisition, engagement, etc.
    table.jsonb('businessSpaceIds').notNullable().defaultsTo(JSON.stringify([])); // optional related spaces
    table.float('targetDailyBudget', undefined, 2);
    table.string('costBiddingStrategy'); // default, 'max-view', 'max-visits' etc.
    table.jsonb('targetLanguages').notNullable().defaultsTo(JSON.stringify(['en-us']));
    table.jsonb('targetLocations').notNullable().defaultsTo(JSON.stringify([])); // ex. [{ latitude: 123, longitude: 456, radiusMeters: 789 }]
    table.timestamp('scheduleStartAt', {
        useTz: true,
    }).notNullable();
    table.timestamp('scheduleStopAt', {
        useTz: true,
    }).notNullable();

    // Audit
    table.timestamp('createdAt', {
        useTz: true,
    }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', {
        useTz: true,
    }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('creatorId').index('organizationId').index(['scheduleStartAt', 'scheduleStopAt']);
});

exports.down = (knex) => knex.schema.dropTable('main.campaigns');
