// User-chosen evening reminder time (Friends with Habits settings → Notifications).
//
//   - settingsPreferredEveningReminderTime: time, nullable. The evening counterpart of
//     `settingsPreferredReminderTime` (20260126000010_main.users_habits.js), which has always
//     been the *morning* target in `utilities/localReminderSchedule.ts` and is now writable
//     from the same screen. NULL means "not set": the digest keeps using its default evening
//     slot (HABIT_LAST_CHANCE_LOCAL_TIME, 19:30 local), so every existing row behaves exactly
//     as it does today.
//
// No backfill and no default on purpose — the scheduler distinguishes an explicit choice from
// the default (an explicit time may sit inside the *default* quiet hours; the default may not),
// and a DEFAULT here would make every user look like they had chosen 19:30.
//
// Additive only, so neither automator can break on it. Idempotent
// (ADD COLUMN IF NOT EXISTS / DROP COLUMN IF EXISTS) per therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = (knex) => knex.raw(
    'ALTER TABLE main."users" ADD COLUMN IF NOT EXISTS "settingsPreferredEveningReminderTime" time',
);

/**
 * @param { import("knex").Knex } knex
 */
exports.down = (knex) => knex.raw(
    'ALTER TABLE main."users" DROP COLUMN IF EXISTS "settingsPreferredEveningReminderTime"',
);
