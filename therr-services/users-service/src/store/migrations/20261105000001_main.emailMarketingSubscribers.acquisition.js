// Campaign attribution on main."emailMarketingSubscribers".
//
// The waitlists (iOS on habits.therr.com, coaches on habits.therr.com/coaches) are demand tests
// that paid traffic is pointed at, but a waitlist signup is not a registration, so nothing was
// written to main."userAcquisition" and a row could not be tied to the ad that produced it. The
// first paid test (a Meta ad run from a vendor's ad account, so no Meta Pixel is possible) made
// this the only place that answer can come from.
//
// Archetype: Identity-shared, NOT brand-scoped, same table and reasoning as
// 20260914000001_main.emailMarketingSubscribers.iosWaitlist.js.
//
//   - acquisition: jsonb, nullable. The same fields as a main."userAcquisition" row (utm*,
//     referrer, landingPath, surface), sanitized by the same function (sanitizeAttribution in
//     UserAcquisitionStore). Written when a row is created or joins a new list, so it records
//     what brought the address onto its latest list. jsonb rather than five columns because it
//     is read by hand in tiny volumes and must stay in step with the userAcquisition shape.
//
// No index: the table is small and the only readers are ad-hoc analysis queries.
//
// Idempotent (ADD COLUMN IF NOT EXISTS) per therr/require-idempotent-migration.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async (knex) => {
    await knex.raw(
        'ALTER TABLE main."emailMarketingSubscribers" '
        + 'ADD COLUMN IF NOT EXISTS "acquisition" jsonb',
    );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async (knex) => {
    await knex.raw('ALTER TABLE main."emailMarketingSubscribers" DROP COLUMN IF EXISTS "acquisition"');
};
