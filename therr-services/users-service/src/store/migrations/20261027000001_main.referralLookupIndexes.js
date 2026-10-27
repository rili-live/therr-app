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
// Built CONCURRENTLY: a plain CREATE INDEX holds a SHARE lock for the whole build, blocking
// every write to main.users and main.invites while it runs on the production tables.
// CONCURRENTLY cannot run inside a transaction block (pg raises 25001), and knex wraps every
// migration in one, so this file opts out. That is safe only because every statement below is
// individually idempotent — keep it that way when editing.
exports.config = {
    transaction: false,
};

// A CONCURRENTLY build that fails (deadlock, cancelled session, conflicting long transaction)
// leaves the index behind marked INVALID rather than removing it. `IF NOT EXISTS` would then
// match it on the retry and skip the build, leaving an index the planner never uses. So clear
// an invalid one first — deliberately narrow, so a healthy index is never dropped and rebuilt.
const dropInvalidIndex = async (knex, schema, indexName) => {
    const { rows } = await knex.raw(
        `SELECT 1
           FROM pg_class c
           JOIN pg_index i ON i.indexrelid = c.oid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = ?
            AND c.relname = ?
            AND NOT i.indisvalid`,
        [schema, indexName],
    );

    if (rows.length) {
        await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${schema}.${indexName}`);
    }
};

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await dropInvalidIndex(knex, 'main', 'idx_invites_requesting_user_id');
    await knex.raw('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invites_requesting_user_id ON main.invites ("requestingUserId");');
    await dropInvalidIndex(knex, 'main', 'idx_invites_lower_email');
    await knex.raw('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invites_lower_email ON main.invites (lower(email));');
    await dropInvalidIndex(knex, 'main', 'idx_users_lower_email');
    await knex.raw('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_lower_email ON main.users (lower(email));');
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    // CONCURRENTLY here too — a plain DROP INDEX takes ACCESS EXCLUSIVE on the table, blocking
    // reads as well as writes. One index per statement: CONCURRENTLY cannot drop several at once.
    await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS main.idx_users_lower_email;');
    await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS main.idx_invites_lower_email;');
    await knex.raw('DROP INDEX CONCURRENTLY IF EXISTS main.idx_invites_requesting_user_id;');
};
