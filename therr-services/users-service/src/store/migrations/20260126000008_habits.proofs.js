exports.up = (knex) => knex.schema.withSchema('habits').createTable('proofs', (table) => {
    table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

    // References
    table.uuid('userId').notNullable()
        .references('id').inTable('main.users')
        .onUpdate('CASCADE').onDelete('CASCADE');
    table.uuid('checkinId').notNullable()
        .references('id').inTable('habits.habit_checkins')
        .onUpdate('CASCADE').onDelete('CASCADE');
    table.uuid('habitGoalId').notNullable()
        .references('id').inTable('habits.habit_goals')
        .onUpdate('CASCADE').onDelete('CASCADE');
    table.uuid('pactId')
        .references('id').inTable('habits.pacts')
        .onUpdate('CASCADE').onDelete('SET NULL');

    // Media
    table.string('mediaType', 20).notNullable(); // image, video
    table.string('mediaPath', 500).notNullable(); // GCS path
    table.string('thumbnailPath', 500); // For videos

    // Verification
    table.string('verificationStatus', 20).notNullable().defaultTo('pending'); // pending, auto_verified, verified, rejected, flagged
    table.timestamp('verifiedAt', { useTz: true });
    table.uuid('verifiedByUserId').references('id').inTable('main.users').onUpdate('CASCADE').onDelete('SET NULL');
    table.text('rejectionReason');

    // Metadata
    table.integer('fileSizeBytes');
    table.integer('durationSeconds'); // For videos
    table.timestamp('capturedAt', { useTz: true }); // From EXIF
    table.jsonb('location'); // Optional GPS from EXIF { lat, lng }

    // Safety
    table.boolean('isSafeForWork').defaultTo(true);
    table.jsonb('moderationFlags'); // Sightengine response

    // Audit
    table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Indexes
    table.index('userId');
    table.index('checkinId');
    table.index('habitGoalId');
    table.index('verificationStatus');
});

exports.down = (knex) => knex.schema.withSchema('habits').dropTableIfExists('proofs');
