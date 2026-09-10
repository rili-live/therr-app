// Create main.notificationQueue — the durable, deduplicated queue that every
// scheduled/deferred notification passes through before it is sent.
//
// Archetype: Brand-scoped (per docs/NICHE_APP_DATABASE_GUIDELINES.md). A queued
// notification belongs to exactly one app — a Habits streak reminder must never
// be readable, or sendable, as a Therr notification.
//
// WHY THIS EXISTS (see docs/NOTIFICATION_QUEUE_DESIGN.md)
//
// Today a notification is sent inline, at the moment the triggering event
// happens, with no record that it happened. Three consequences:
//
//   1. No dedup. The habits digest re-sends everything if it runs twice; root
//      CLAUDE.md carries a standing rule ("never add a second trigger path")
//      whose only enforcement is that exactly one Cloud Scheduler job exists.
//      The UNIQUE index below replaces that convention with a constraint.
//   2. No scheduling. "Send in the evening" means one global Cloud Scheduler
//      firing — evening in exactly one timezone. `scheduledFor` decouples
//      "decide to notify" from "notify", which is what send-time
//      personalization needs.
//   3. No rate limiting across types. Nothing counts what a user has already
//      received today, so raising send frequency has no safety valve. A single
//      queue is the chokepoint where a per-user daily cap can exist at all.
//
// Index / constraint strategy:
//   - UNIQUE (brandVariation, userId, dedupeKey) is the load-bearing one.
//     `dedupeKey` is caller-supplied and must encode everything that makes the
//     notification distinct, including its period — e.g.
//     `streak-at-risk:<pactId>:2026-08-08`. Enqueue is ON CONFLICT DO NOTHING,
//     so a re-run inserts nothing and re-sends nothing. Getting this key wrong
//     is the one way to reintroduce duplicate sends, so it is the caller's
//     explicit responsibility rather than something derived implicitly here.
//   - The claim index is PARTIAL, on ('pending') rows only, leading with
//     scheduledFor. The queue is expected to be almost entirely 'sent' rows
//     awaiting retention cleanup, and a partial index keeps the hot path
//     proportional to the backlog rather than to history.
//   - (brandVariation, userId, sentAt) supports the per-user rate-limit count.
//
// `payload` is jsonb rather than columns per field because it carries the
// ISendPushNotification extras (habitName, partnerName, streakCount, …), which
// differ per notification type and change whenever copy changes. Those fields
// are never queried on — only read back and forwarded — so there is nothing to
// gain from promoting them to columns, and a schema change per new
// notification type to lose.
//
// Idempotent (hasTable probe, CREATE INDEX IF NOT EXISTS) per
// therr/require-idempotent-migration. Note createTable is guarded rather than
// using createTableIfNotExists, which Knex itself warns against and the lint
// rule flags.

const TABLE = 'main."notificationQueue"';

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    const exists = await knex.schema.withSchema('main').hasTable('notificationQueue');

    if (!exists) {
        await knex.schema.withSchema('main').createTable('notificationQueue', (table) => {
            table.uuid('id').primary().notNullable().defaultTo(knex.raw('uuid_generate_v4()'));

            table.uuid('userId').notNullable()
                .references('id').inTable('main.users')
                .onUpdate('CASCADE')
                .onDelete('CASCADE');

            // No default. Every other brand-scoped table defaults to 'therr' so
            // pre-existing rows stay visible after a backfill; this table is
            // brand-scoped from birth with no legacy rows, so a default would
            // only let a caller that forgot the brand silently file its
            // notification as Therr's.
            table.string('brandVariation', 50).notNullable();

            // PushNotifications.Types value. Deliberately not a pg enum: the set
            // grows with every new notification, and adding an enum value is DDL
            // that cannot share a transaction with other DDL.
            table.string('type', 100).notNullable();

            table.string('dedupeKey', 255).notNullable();

            table.jsonb('payload').notNullable().defaultTo('{}');

            // pending | sent | failed | skipped
            //   skipped = deliberately not sent (rate cap, user preference,
            //   no device token). Distinct from failed so that suppression is
            //   measurable rather than looking like breakage.
            table.string('status', 20).notNullable().defaultTo('pending');

            // When this becomes eligible to send. Defaults to now() so an
            // "as soon as possible" enqueue needs no argument.
            table.timestamp('scheduledFor', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.integer('attempts').notNullable().defaultTo(0);
            table.text('lastError');

            table.timestamp('sentAt', { useTz: true });
            table.timestamp('createdAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('updatedAt', { useTz: true }).notNullable().defaultTo(knex.fn.now());

            table.unique(['brandVariation', 'userId', 'dedupeKey']);
        });
    }

    // Created outside the table builder so re-running against a table that
    // already exists still converges on the full index set.
    await knex.raw(
        `CREATE INDEX IF NOT EXISTS "notificationQueue_claim_idx"
         ON ${TABLE} ("scheduledFor", "brandVariation")
         WHERE "status" = 'pending'`,
    );
    await knex.raw(
        `CREATE INDEX IF NOT EXISTS "notificationQueue_rate_idx"
         ON ${TABLE} ("brandVariation", "userId", "sentAt")`,
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main."notificationQueue_claim_idx"');
    await knex.raw('DROP INDEX IF EXISTS main."notificationQueue_rate_idx"');
    await knex.schema.withSchema('main').dropTableIfExists('notificationQueue');
};
