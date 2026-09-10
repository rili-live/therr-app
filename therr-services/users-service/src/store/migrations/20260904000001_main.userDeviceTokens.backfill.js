/**
 * Backfill main.userDeviceTokens from the legacy users.deviceMobileFirebaseToken column,
 * so the read-time fallback in `resolveDeviceTokenForBrand` can be deleted.
 *
 * Archetype: Data backfill on a brand-scoped table (docs/NICHE_APP_DATABASE_GUIDELINES.md).
 *
 * ## Why this exists now, when 20260425000003 explicitly declined to backfill
 *
 * That migration's reasoning still holds and is not overturned here: the legacy column
 * carries no brand marker, so copying it wholesale would guess a brand (in practice
 * 'therr') and produce wrong-app routing for anyone whose device last registered under a
 * different brand. This migration does NOT do that. It backfills only the rows where the
 * brand is *derivable*, and deliberately leaves the ambiguous ones empty.
 *
 * What changed is that a signal now exists which did not in April: `main.users`.
 * "brandVariations" was normalized to a canonical array-of-objects by
 * 20260719000001_main.users.brandVariations_backfill.js. For a user who belongs to exactly
 * one brand, the legacy token can only have been written by that brand's app — there is no
 * other app on the account to have overwritten it. That is a derivation, not a guess.
 *
 * ## The three cases
 *
 *   1. The user already has ANY row for a brand  -> insert nothing for that brand.
 *      A real registration is strictly better evidence than the shared column, and adding
 *      a second row would put a possibly-stale token into `getTokensForUser`'s
 *      newest-first ordering, where it could outrank the real one.
 *
 *   2. The user resolves to exactly ONE known brand -> insert that brand's row.
 *      This is the population the read-time fallback was actually protecting: single-brand
 *      accounts whose device has not re-registered since Phase 2.
 *
 *   3. The user belongs to two or more brands -> insert nothing. Intentionally.
 *      This is the leak case (a Friends with Habits reminder arriving in Therr), and it is
 *      unknowable from the data: the shared column holds whichever app registered last, and
 *      nothing records which that was. Writing a row here would launder a guess into a
 *      fact and make the leak permanent instead of transient. With no row, the send is
 *      skipped as 'no-device-token' — visible and measurable — until the app writes the
 *      real row on its next open, which TherrMobile now does once per app session
 *      unconditionally (see Layout.tsx `registerDeviceForFCM`).
 *
 * ## Details worth knowing
 *
 * - platform is LEGACY_TOKEN_PLATFORM ('mobile'), matching what an un-upgraded client
 *   sends. It is honoured by routing but superseded by a real 'ios'/'android'
 *   registration, which `syncDeviceTokenForBrand` then deletes. So these rows retire
 *   themselves.
 *
 * - createdAt/updatedAt are taken from users."updatedAt", not now(). Any write to the
 *   legacy column went through UpdateUser, which touches that timestamp, so it is the
 *   closest available upper bound on when the token was last seen. Stamping now() would
 *   report a years-stale token as a fresh registration in the push-diagnostics endpoint.
 *
 * - The brand allow-list is inlined rather than imported: migrations run from compiled
 *   output under a plain Knex CLI, with no path back into therr-js-utilities. Keep it in
 *   sync with `BrandVariations` in
 *   therr-public-library/therr-js-utilities/src/constants/enums/Branding.ts.
 *
 * Idempotent: the NOT EXISTS guard excludes every user who has a row for the target brand,
 * which after a first run includes everyone this migration inserted. ON CONFLICT DO NOTHING
 * covers the unique key regardless. A second run inserts zero rows.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

// Keep in sync with BrandVariations (therr-js-utilities/src/constants/enums/Branding.ts).
const KNOWN_BRANDS = [
    'appy-social',
    'parallels',
    'teem',
    'therr',
    'dashboard-therr',
    'otaku',
    'habits',
];

const LEGACY_TOKEN_PLATFORM = 'mobile';

exports.up = async (knex) => {
    await knex.raw(
        `
        INSERT INTO main."userDeviceTokens" ("userId", "brandVariation", "platform", "token", "createdAt", "updatedAt")
        SELECT
            u.id,
            b.brand,
            ?,
            u."deviceMobileFirebaseToken",
            u."updatedAt",
            u."updatedAt"
        FROM main.users u
        -- Exactly one known brand on the account, or the row is skipped entirely.
        -- A user carrying an unrecognised brand alongside a known one is NOT
        -- single-brand for this purpose: the unknown entry may well be the app that
        -- wrote the token, so the account stays ambiguous and gets no row.
        JOIN LATERAL (
            SELECT DISTINCT elem ->> 'brand' AS brand
            FROM jsonb_array_elements(u."brandVariations") elem
            WHERE jsonb_typeof(elem) = 'object'
        ) b ON TRUE
        WHERE u."deviceMobileFirebaseToken" IS NOT NULL
            AND u."deviceMobileFirebaseToken" <> ''
            AND jsonb_typeof(u."brandVariations") = 'array'
            AND (
                SELECT COUNT(DISTINCT elem ->> 'brand')
                FROM jsonb_array_elements(u."brandVariations") elem
                WHERE jsonb_typeof(elem) = 'object'
            ) = 1
            AND b.brand = ANY(?)
            AND NOT EXISTS (
                SELECT 1 FROM main."userDeviceTokens" t
                WHERE t."userId" = u.id AND t."brandVariation" = b.brand
            )
        ON CONFLICT ("userId", "brandVariation", "platform") DO NOTHING;
        `,
        [LEGACY_TOKEN_PLATFORM, KNOWN_BRANDS],
    );
};

/**
 * Data backfill only, and non-destructive in the forward direction: every row it writes is
 * a token the previous code path would have used anyway, now recorded explicitly. Rolling
 * the code back with these rows in place is correct — the restored fallback simply never
 * gets reached for them — so there is nothing to undo. Deleting them would instead be the
 * risky move, since a real registration may since have upserted onto the same unique key.
 *
 * Matches the precedent set by 20260719000001_main.users.brandVariations_backfill.js.
 *
 * @returns { Promise<void> }
 */
exports.down = async () => {
    // No-op: the backfilled rows are a superset-compatible state; nothing to revert.
};
