/**
 * Add brandVariation to main.invites.
 *
 * Archetype: Brand-scoped attribute (per docs/NICHE_APP_DATABASE_GUIDELINES.md).
 *
 * An invite is minted inside one app but redeemed via a magic link that any installed
 * brand can open. Before this column there was no way to tell which app an invite came
 * from, so the invite-landing page could not route the invitee to the right install.
 *
 * Note this is deliberately NOT a hard cross-brand rejection: getInviteByToken still
 * resolves an invite opened from another brand, and now returns its origin brand so the
 * landing page can deep-link the correct app instead of dead-ending on a 404.
 *
 * Defaults:
 *   - NOT NULL with default 'therr' so the existing invite backlog (all minted by the
 *     original Therr app, including rows backfilled with tokens by
 *     20260703000001_main.invites.token) keeps resolving as Therr invites.
 *
 * Index strategy:
 *   - None added. The only read path that surfaces this column is getInviteByToken,
 *     which filters on the already-unique `token` column; brandVariation is returned as
 *     an attribute, never used as a predicate. The bulk-invite dedupe path filters on
 *     (requestingUserId, email/phoneNumber) and is likewise unaffected. Adding a
 *     low-cardinality index here would cost write throughput on the invite fan-out for
 *     no read benefit.
 *
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.schema.withSchema('main').alterTable('invites', (table) => {
        table.string('brandVariation', 50).notNullable().defaultTo('therr');
    });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.schema.withSchema('main').alterTable('invites', (table) => {
        table.dropColumn('brandVariation');
    });
};
