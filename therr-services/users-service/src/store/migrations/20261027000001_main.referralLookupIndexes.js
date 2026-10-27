// Indexes for the referral-reward lookups in ReferralRewardsStore.
//
// `getReferrersOf` runs after every completed check-in, and `getReferredFriends` after every
// check-in by someone a referrer brought in. Their invite branch joins main.invites to
// main.users on `lower(email)` or phone number. Phone was already indexed on both tables;
// these cover the rest:
//
//   idx_invites_requesting_user_id — "invites this user sent" (getReferredFriends)
//   idx_invites_lower_email        — "invites sent to this user's email" (getReferrersOf)
//   idx_users_lower_email          — "the account an invite's email became" (getReferredFriends)
//
// The existing UNIQUE indexes on invites.email and users.email cannot serve a `lower()`
// comparison; without these, both queries scan the table.
//
// Plain CREATE INDEX IF NOT EXISTS, as in 20260318000001_main.performance_indexes.js, so it
// runs inside knex's migration transaction and is safe to re-run.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_invites_requesting_user_id ON main.invites ("requestingUserId");');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_invites_lower_email ON main.invites (lower(email));');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_users_lower_email ON main.users (lower(email));');
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main.idx_users_lower_email;');
    await knex.raw('DROP INDEX IF EXISTS main.idx_invites_lower_email;');
    await knex.raw('DROP INDEX IF EXISTS main.idx_invites_requesting_user_id;');
};
