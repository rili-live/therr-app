// Charity pledges, Phase A (WORK_IN_PROGRESS § 2.8, #2990): a member's own pledge on a pact.
//
//   - pledge: jsonb, nullable. `{ amount, charityKey, pledgedAt }` — see `IHabitPledge` in
//     therr-js-utilities/constants/habitPledges.ts. NULL means no pledge, which is what every
//     existing row means.
//
// Why per member and not the pact's existing `consequenceType` / `consequenceDetails`: those
// sit on habits.pacts, so a pledge stored there would bind every member to a promise one of
// them made. A pledge is personal — each member backs their own week, and is judged on it.
// `consequenceType` is left untouched; nothing reads it today.
//
// Pact-only by decision: solo habits get no pledge in Phase A. A pledge nobody else can see
// honoured loses the half of the mechanic this brand is about.
//
// Additive only, so neither automator can break on it. Idempotent
// (ADD COLUMN IF NOT EXISTS) per therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE habits."pact_members" ADD COLUMN IF NOT EXISTS "pledge" jsonb');
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('ALTER TABLE habits."pact_members" DROP COLUMN IF EXISTS "pledge"');
};
