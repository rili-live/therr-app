// Create main.drops — a note or photo one user leaves at a place for one connection, which opens
// only once that person goes there. See docs/DROPS.md.
//
// Archetype: Brand-scoped (docs/NICHE_APP_DATABASE_GUIDELINES.md). A drop is left inside one app
// and is read there: a Therr drop must never surface in Friends with Habits, which has no screen
// for it. Listed in eslint-config/brand-scoped-tables.js and read only through DropsStore.
//
// WHAT A ROW MEANS
//
// One row per (drop, recipient). Leaving the same drop for three friends writes three rows that
// share `batchId`, because each recipient opens, dismisses and is notified about their own copy
// independently, and a per-recipient row keeps every read a single-table, single-predicate query.
//
//   latitude / longitude — where the drop is. Shown to the recipient exactly: they are the person
//                          the sender chose to send there, and a vague circle only makes the trip
//                          harder. What is withheld until it is opened is the *content*.
//   unlockRadiusMeters   — how close the recipient must be. Clamped server-side (utilities/drops.ts).
//   message / mediaPath  — the content. Never returned to the recipient while the drop is locked.
//                          `mediaPath` is a private-bucket object under the sender's own prefix; a
//                          private path resolves to a deterministic URL, so the path itself is the
//                          secret and is only ever turned into a URL by this service.
//   openedAt             — set once, by the recipient's first successful open. The sender is shown
//                          only the day (`openedOn`), never the time.
//   recipientDismissedAt — the recipient hid it from their list. The sender's copy is unaffected.
//
// The sender deletes a drop outright (a hard delete of their own row); there is no sender-side
// soft delete, because nothing reads a deleted drop.
//
// Not read by either Cloud Function automator.
//
// Indexes, declared inside createTable so they exist the moment the table does:
//   - (brandVariation, toUserId, createdAt) — the recipient's inbox.
//   - (brandVariation, fromUserId, createdAt) — the sender's list and the daily send cap.
//
// Idempotent per therr/require-idempotent-migration: a hasTable probe guards createTable.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('main').hasTable('drops');
    if (!exists) {
        await knex.schema.withSchema('main').createTable('drops', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
            table.string('brandVariation', 50).notNullable().defaultTo('therr');
            table.uuid('batchId').notNullable();
            table.uuid('fromUserId').notNullable()
                .references('id')
                .inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.uuid('toUserId').notNullable()
                .references('id')
                .inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');
            table.text('message').notNullable().defaultTo('');
            table.text('mediaPath');
            table.string('mediaType', 50);
            table.double('latitude').notNullable();
            table.double('longitude').notNullable();
            table.integer('unlockRadiusMeters').notNullable();
            table.string('placeName', 120);
            // A maps-service space, when the drop was left at one. No foreign key: spaces live in
            // another service's database.
            table.uuid('spaceId');
            table.timestamp('expiresAt', { useTz: true }).notNullable();
            table.timestamp('openedAt', { useTz: true });
            table.timestamp('recipientDismissedAt', { useTz: true });
            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.index(['brandVariation', 'toUserId', 'createdAt'], 'idx_drops_brand_to_created');
            table.index(['brandVariation', 'fromUserId', 'createdAt'], 'idx_drops_brand_from_created');
        });
    }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.schema.withSchema('main').dropTableIfExists('drops');
};
