// Coach waitlist demand signal on main."emailMarketingSubscribers".
//
// habits.therr.com/coaches tests whether coaches who sell habit-based programs will pay for a
// client-accountability tool before any of that tool is built. The page's waitlist form is the
// whole test, so the table has to answer two questions the GA4 click count cannot: who to email
// when the coach view exists, and whether enough of them said they would pay for it.
//
// Archetype: Identity-shared, NOT brand-scoped — same table and same reasoning as
// 20260914000001_main.emailMarketingSubscribers.iosWaitlist.js. One address is one row across
// every app (UNIQUE on `email`), so no brandVariation read predicate.
//
//   - isSubscribedToCoachesWaitlist: DEFAULT false. Set on insert, and set on an address that
//     already subscribed for something else — createSubscriber upgrades rather than rejecting.
//   - coachesWaitlistDetails: the form's three qualifiers (coaching type, client count, what
//     they would pay per month). jsonb rather than three columns because the question set is an
//     experiment and will change; the handler whitelists every value against a fixed set, so
//     nothing free-form is stored.
//
// Index: the only query is "which coaches are waiting, newest first" — a tiny subset of the
// table — so a partial index on the flag, like the iOS one.
//
// Idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS) per
// therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw(
        'ALTER TABLE main."emailMarketingSubscribers" '
        + 'ADD COLUMN IF NOT EXISTS "isSubscribedToCoachesWaitlist" boolean NOT NULL DEFAULT false',
    );
    await knex.raw(
        'ALTER TABLE main."emailMarketingSubscribers" '
        + 'ADD COLUMN IF NOT EXISTS "coachesWaitlistDetails" jsonb',
    );
    await knex.raw(
        'CREATE INDEX IF NOT EXISTS "idx_email_subscribers_coaches_waitlist" '
        + 'ON main."emailMarketingSubscribers" ("brandVariation", "createdAt") '
        + 'WHERE "isSubscribedToCoachesWaitlist" = true',
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main."idx_email_subscribers_coaches_waitlist"');
    await knex.raw('ALTER TABLE main."emailMarketingSubscribers" DROP COLUMN IF EXISTS "coachesWaitlistDetails"');
    await knex.raw('ALTER TABLE main."emailMarketingSubscribers" DROP COLUMN IF EXISTS "isSubscribedToCoachesWaitlist"');
};
