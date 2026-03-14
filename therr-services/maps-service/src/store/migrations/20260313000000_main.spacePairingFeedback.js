exports.up = (knex) => knex.schema.withSchema('main').createTable('spacePairingFeedback', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('sourceSpaceId').notNullable();
    table.uuid('pairedSpaceId').notNullable();
    table.uuid('userId');
    table.boolean('isHelpful').notNullable();

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('sourceSpaceId');
}).then(() => knex.raw(`
    CREATE UNIQUE INDEX idx_pairing_feedback_unique
    ON main."spacePairingFeedback" ("sourceSpaceId", "pairedSpaceId", "userId")
    WHERE "userId" IS NOT NULL
`));

exports.down = (knex) => knex.schema.withSchema('main').dropTable('spacePairingFeedback');
