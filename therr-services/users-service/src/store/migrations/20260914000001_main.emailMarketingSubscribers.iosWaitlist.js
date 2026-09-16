// iOS waitlist demand signal on main."emailMarketingSubscribers".
//
// Neither Therr nor Friends with Habits has a published iOS build (see
// docs/niche-sub-apps/PROJECT_BRIEF.md — "iOS app not yet published"), and the App Store
// badge on the marketing pages pointed at a listing that no longer serves one. The landing
// pages now open a waitlist modal instead, and these two columns are what turn that click
// into a number somebody can act on: GA4 counts the clicks, this table holds the addresses
// to actually email when a build ships.
//
// Archetype: Identity-shared, NOT brand-scoped, so it is deliberately absent from
// eslint-config/brand-scoped-tables.js. `email` carries a UNIQUE constraint — one address is
// one row across every app — so a brandVariation predicate on reads would hide subscribers
// rather than isolate them. The column here is provenance ("which landing page did this
// address come from"), not a scoping key, and must never be used as one.
//
//   - brandVariation: NOT NULL DEFAULT 'therr' so the ~existing rows, all created by the
//     Therr web signup form before any niche app existed, keep their true origin.
//   - isSubscribedToIosWaitlist: DEFAULT false. Set on insert, and also set on an address
//     that already subscribed to general updates — see createSubscriber in
//     handlers/subscribers.ts, which upgrades rather than rejecting in that case.
//
// Index: the only query is "who is waiting on iOS, for this app" — a tiny subset of the
// table — so a partial index on the flag is far smaller than a composite leading on a
// boolean, and orders by signup recency for the announcement send.
//
// Idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS) per
// therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw(
        'ALTER TABLE main."emailMarketingSubscribers" '
        + 'ADD COLUMN IF NOT EXISTS "brandVariation" varchar(50) NOT NULL DEFAULT \'therr\'',
    );
    await knex.raw(
        'ALTER TABLE main."emailMarketingSubscribers" '
        + 'ADD COLUMN IF NOT EXISTS "isSubscribedToIosWaitlist" boolean NOT NULL DEFAULT false',
    );
    await knex.raw(
        'CREATE INDEX IF NOT EXISTS "idx_email_subscribers_ios_waitlist" '
        + 'ON main."emailMarketingSubscribers" ("brandVariation", "createdAt") '
        + 'WHERE "isSubscribedToIosWaitlist" = true',
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('DROP INDEX IF EXISTS main."idx_email_subscribers_ios_waitlist"');
    await knex.raw('ALTER TABLE main."emailMarketingSubscribers" DROP COLUMN IF EXISTS "isSubscribedToIosWaitlist"');
    await knex.raw('ALTER TABLE main."emailMarketingSubscribers" DROP COLUMN IF EXISTS "brandVariation"');
};
