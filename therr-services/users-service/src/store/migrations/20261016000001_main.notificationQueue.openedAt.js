// Push open tracking on main.notificationQueue (docs/NOTIFICATION_QUEUE_DESIGN.md → "Open tracking").
//
//   - openedAt: timestamptz, nullable. When the recipient first tapped the push this row sent.
//     NULL on a 'sent' row means delivered-or-not, never opened. First tap wins: the device can
//     report the same tap through more than one listener, and a later tap is not a second open.
//   - openAction: varchar(100), nullable. The press action the tap came through ('default' for
//     the body, otherwise the button id: 'habit-checkin', 'checkin-view', ...). Lets "opened"
//     be split from "acted on straight from the tray", which never opens the app at all.
//
// The row already holds everything else an open rate needs — type, brandVariation, userId,
// scheduledFor and sentAt — so opens per type and per local send hour are a query over this
// table, not a new one.
//
// No index: every read is an aggregate over the 30-day retention window, and the table is
// pruned to that window by the worker.
//
// Additive only; neither automator reads this table. Idempotent (ADD COLUMN IF NOT EXISTS /
// DROP COLUMN IF EXISTS) per therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE main."notificationQueue" ADD COLUMN IF NOT EXISTS "openedAt" timestamptz');
    await knex.raw('ALTER TABLE main."notificationQueue" ADD COLUMN IF NOT EXISTS "openAction" varchar(100)');
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('ALTER TABLE main."notificationQueue" DROP COLUMN IF EXISTS "openAction"');
    await knex.raw('ALTER TABLE main."notificationQueue" DROP COLUMN IF EXISTS "openedAt"');
};
