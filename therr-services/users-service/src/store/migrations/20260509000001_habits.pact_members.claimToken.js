// Archetype: Brand-only (habits schema)
//
// Adds claim-token columns to habits.pact_members so a Habits user can
// invite a pre-existing Therr connection (who has not yet installed Habits)
// to a pact. The email/SMS sent to the invitee carries either a long
// claimToken (for deep links) or a short claimCode (for manual entry on the
// Register screen). Either redeems the same pending pact_members row.
//
// invitedVia records the channel used so we can dedupe re-invites and
// produce simple funnel analytics later.

exports.up = (knex) => knex.schema.withSchema('habits').alterTable('pact_members', (table) => {
    table.string('claimToken', 64);
    table.string('claimCode', 16);
    table.timestamp('claimTokenExpiresAt', { useTz: true });
    table.string('invitedVia', 16); // 'email' | 'sms' | 'push' | 'in-app'

    table.index('claimToken');
})
    .then(() => knex.raw(
        'CREATE UNIQUE INDEX pact_members_claimcode_unique ON habits.pact_members ("claimCode") WHERE "claimCode" IS NOT NULL',
    ));

exports.down = (knex) => knex.raw('DROP INDEX IF EXISTS habits.pact_members_claimcode_unique')
    .then(() => knex.schema.withSchema('habits').alterTable('pact_members', (table) => {
        table.dropIndex('claimToken');
        table.dropColumn('claimToken');
        table.dropColumn('claimCode');
        table.dropColumn('claimTokenExpiresAt');
        table.dropColumn('invitedVia');
    }));
