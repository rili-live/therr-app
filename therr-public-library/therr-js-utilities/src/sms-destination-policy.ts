import { parsePhoneNumber } from 'awesome-phonenumber';

/**
 * Which phone numbers we are willing to pay to text.
 *
 * Every SMS we send costs real money, and several of our send sites text a number the caller
 * typed — two of them unauthenticated. That is the shape SMS pumping (artificially inflated
 * traffic) exploits: an attacker drives verification texts to premium-rate ranges they collect
 * a share of, rotating IPs and numbers so per-IP and per-number limits never trip. Those ranges
 * sit overwhelmingly outside the countries we serve, so a destination allowlist removes the
 * revenue the attack depends on instead of merely slowing it down.
 *
 * Gate by *region*, never by dialing prefix: `+1` also covers ~20 Caribbean NANP countries
 * (Jamaica +1-876, Dominican Republic +1-809, …) that are classic pumping destinations and that
 * a `startsWith('+1')` check would happily treat as American.
 */

// Two tiers. Keep their union in step with Twilio's Messaging Geo Permissions, which are the
// account-level copy of this list — a country must be enabled in both places to receive a text.
//
// CORE: countries where we have users *and* Twilio charges at most ~$0.10 a text. Price is the
// filter because pumping is paid out of the termination fee — on 2026-10-21, after the broader
// list shipped, the attack moved within hours to Bolivia ($0.22), the priciest region it still
// allowed. Normal per-IP, per-number and global limits apply. Check a candidate's price with the
// Twilio Pricing API (`/v1/Messaging/Countries/<ISO>`) before adding it.
export const DEFAULT_SMS_ALLOWED_REGIONS = [
    // North America (NANP regions only — Caribbean +1 is excluded by region, see above)
    'US', 'CA', 'PR',
    // UK and Western/Northern Europe
    'GB', 'IE', 'FR', 'DE', 'IT', 'ES', 'PT', 'PL', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI',
    // Asia-Pacific and Turkey
    'IN', 'TR', 'AU', 'SG',
];

// EXTENDED: regions we want to keep reachable despite a text costing several times the core price.
// Allowed, but every send also draws on one small shared hourly budget (see the gateway's
// `chargeExtendedSmsBudget`), so a pumping run aimed here is capped at a few texts an hour instead
// of the global ceiling. Empty by default; trial a region via `TWILIO_SMS_EXTENDED_REGIONS` and
// enable it in Twilio Geo Permissions at the same time.
export const DEFAULT_SMS_EXTENDED_REGIONS: string[] = [];

// UNATTESTED: where a verification text may go when the request carries no valid App Check token —
// every app build that predates App Check, and every script. Kept to the cheapest destinations, so
// a pumping run that never touches the real app has nothing worth collecting. See the gateway's
// `./appAttestation`.
export const DEFAULT_SMS_UNATTESTED_REGIONS = ['US', 'CA'];

export type SmsDestinationTier = 'core' | 'extended';

// Number types that are never a legitimate person's handset, whatever their country.
const DISALLOWED_NUMBER_TYPES = ['premium-rate', 'shared-cost', 'toll-free'];

const parseRegionList = (rawRegions: string | undefined, fallback: string[]): string[] => {
    const regions = `${rawRegions || ''}`
        .split(',')
        .map((region) => region.trim().toUpperCase())
        .filter(Boolean);

    return regions.length ? regions : fallback;
};

/**
 * Reads `TWILIO_SMS_ALLOWED_REGIONS` (the core tier; comma-separated ISO 3166-1 alpha-2 codes, e.g.
 * `US,CA,MX,GB`) at call time rather than module load, so it can't be silently captured before
 * dotenv runs. Set it only to override the default in code.
 */
export const getSmsAllowedRegions = (rawRegions = process.env.TWILIO_SMS_ALLOWED_REGIONS): string[] => parseRegionList(
    rawRegions,
    DEFAULT_SMS_ALLOWED_REGIONS,
);

/** Reads `TWILIO_SMS_EXTENDED_REGIONS` (the extended tier), the same way. */
export const getSmsExtendedRegions = (rawRegions = process.env.TWILIO_SMS_EXTENDED_REGIONS): string[] => parseRegionList(
    rawRegions,
    DEFAULT_SMS_EXTENDED_REGIONS,
);

/** Reads `TWILIO_SMS_UNATTESTED_REGIONS` (requests without a valid App Check token), the same way. */
export const getSmsUnattestedRegions = (rawRegions = process.env.TWILIO_SMS_UNATTESTED_REGIONS): string[] => parseRegionList(
    rawRegions,
    DEFAULT_SMS_UNATTESTED_REGIONS,
);

/**
 * The region of a textable number, or `undefined` when it isn't one: anything that doesn't parse,
 * lacks the `+` country code, or is a premium/shared-cost/toll-free line. Accepts E.164 or the
 * formatted dialect stored in `main.users.phoneNumber` (`+1 317-555-1234`).
 */
const getTextableRegion = (phoneNumber: string): string | undefined => {
    const cleaned = `${phoneNumber || ''}`.replace(/[^\d+]/g, '');

    if (!cleaned.startsWith('+')) {
        return undefined;
    }

    const parsed = parsePhoneNumber(cleaned);

    if (!parsed.valid || !parsed.regionCode || DISALLOWED_NUMBER_TYPES.includes(`${parsed.type}`)) {
        return undefined;
    }

    return parsed.regionCode;
};

/**
 * Which tier a destination falls in, or `undefined` when it may not be texted at all. Fails closed.
 * Core wins if an override puts a region in both lists.
 */
export const getSmsDestinationTier = (
    phoneNumber: string,
    coreRegions = getSmsAllowedRegions(),
    extendedRegions = getSmsExtendedRegions(),
): SmsDestinationTier | undefined => {
    const region = getTextableRegion(phoneNumber);

    if (!region) {
        return undefined;
    }

    if (coreRegions.includes(region)) {
        return 'core';
    }

    return extendedRegions.includes(region) ? 'extended' : undefined;
};

/**
 * True only for a **core-tier** destination. Send sites with no budget of their own (users-service
 * invites) use this; the gateway's verification texts use `getSmsDestinationTier`, which also
 * admits the extended tier against its hourly budget.
 */
export const isSmsDestinationAllowed = (
    phoneNumber: string,
    allowedRegions = getSmsAllowedRegions(),
): boolean => getSmsDestinationTier(phoneNumber, allowedRegions, []) === 'core';

/** Error message a send site rejects with when the destination fails `isSmsDestinationAllowed`. */
export const SMS_DESTINATION_NOT_ALLOWED = 'SMS destination is not in an allowed region';
