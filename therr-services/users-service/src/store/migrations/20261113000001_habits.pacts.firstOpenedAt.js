// The first time a pact is opened to join requests (habits.pacts.isOpen), it is announced.
//
//   - firstOpenedAt: timestamptz, nullable. When this pact was first opened, by its creator at
//     creation or later with the open toggle. NULL means never opened. It is the claim that keeps
//     the two once-per-pact rewards for opening to once per pact: the open-pact announcement push
//     to people tracking the same habit, and the creator's XP for opening it
//     (handlers/helpers/openPactAnnouncement.ts). Set with a conditional UPDATE before either
//     happens, so toggling a pact closed and open again announces nothing and earns nothing.
//
// Pacts opened before this column existed stay NULL. Their first re-open after deploy is
// announced once, which is the intended behaviour for a pact that was never announced.
//
// No index: it is only ever written by primary key. Additive only; neither automator reads
// habits.pacts' open-pact columns. Idempotent (ADD COLUMN IF NOT EXISTS / DROP COLUMN IF EXISTS)
// per therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE habits."pacts" ADD COLUMN IF NOT EXISTS "firstOpenedAt" timestamptz');
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('ALTER TABLE habits."pacts" DROP COLUMN IF EXISTS "firstOpenedAt"');
};
