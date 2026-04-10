exports.up = (knex) => knex.schema.withSchema('main').createTable('spaceDisplayRequests', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('spaceId').notNullable();
    table.uuid('fromUserId').notNullable();
    table.string('displayType', 20).notNullable();
    table.string('status', 20).notNullable().defaultTo('pending');

    // Shipping info
    table.string('shippingName', 120);
    table.string('shippingAddress', 200);
    table.string('shippingCity', 100);
    table.string('shippingRegion', 100);
    table.string('shippingPostalCode', 20);
    table.string('shippingCountry', 10).defaultTo('US');
    table.string('trackingNumber', 100);

    // Audit
    table.timestamp('requestedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('shippedAt', { useTz: true });
    table.timestamp('deliveredAt', { useTz: true });
    table.text('notes');

    // Indexes
    table.index('spaceId');
    table.index('status');
    table.index('requestedAt');
}).then(() => knex.raw(`
    ALTER TABLE main."spaceDisplayRequests"
    ADD CONSTRAINT chk_display_type CHECK ("displayType" IN ('coaster', 'table_tent', 'window_cling')),
    ADD CONSTRAINT chk_status CHECK ("status" IN ('pending', 'printed', 'shipped', 'delivered', 'cancelled'))
`));

exports.down = (knex) => knex.schema.withSchema('main').dropTable('spaceDisplayRequests');
