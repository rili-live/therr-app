// The email fallback for an unanswered join request (handlers/helpers/joinRequestEmailDigest.ts).
//
//   - emailReminderSentAt: timestamptz, nullable. When the pact's creator was emailed about this
//     request. NULL means never emailed. It is the claim that keeps the email to once per request:
//     the digest sets it with a conditional UPDATE before sending, so a re-run, an overlapping run
//     or a retry after a partial failure emails nobody twice.
//
// No index: the digest reads pending requests 1-7 days old, and the table only ever holds a few
// pending requests per open pact (MAX_PENDING_JOIN_REQUESTS_PER_USER, MAX_OPEN_PACT_MEMBERS).
//
// Additive only; neither automator reads habits.pact_join_requests. Idempotent (ADD COLUMN IF NOT
// EXISTS / DROP COLUMN IF EXISTS) per therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('ALTER TABLE habits."pact_join_requests" ADD COLUMN IF NOT EXISTS "emailReminderSentAt" timestamptz');
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('ALTER TABLE habits."pact_join_requests" DROP COLUMN IF EXISTS "emailReminderSentAt"');
};
