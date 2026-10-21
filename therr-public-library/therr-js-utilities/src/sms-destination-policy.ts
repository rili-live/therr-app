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
// CORE: where our users are and where SMS is cheap and rarely pumped. Normal per-IP, per-number and
// global limits apply.
export const DEFAULT_SMS_ALLOWED_REGIONS = [
    // North America
    'US', 'CA', 'MX', 'PR',
    // Spanish-speaking South America
    'AR', 'BO', 'CL', 'CO', 'EC', 'PE', 'PY', 'UY', 'VE',
    // EU / EEA, the UK, Switzerland and the French- and English-speaking microstates. Not Slovenia:
    // ~600 of the 2026-10-20/21 pumped texts went to Slovenian +386 65 numbers (the rest to Belarus
    // and Egypt), so it stays out until there is a real user there to weigh against that.
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT',
    'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH', 'MC', 'AD',
    // English-speaking Asia-Pacific
    'AU', 'NZ', 'SG',
];

// EXTENDED: English- and French-speaking markets (and non-EU Europe) worth reaching for growth, but
// where a text costs many times a US one and pumping is common. Allowed, but every send also draws on
// one small shared hourly budget (see the gateway's `chargeExtendedSmsBudget`), so a pumping run
// aimed here is capped at a few texts an hour instead of the global ceiling.
//
// Deliberately absent: the 2026-10 attack's destinations (Belarus, Egypt, Slovenia), Twilio's own
// "High Risk" countries (NG, PK, BD, LK, DZ, TN, …), small
// Caribbean and Pacific island nations (the classic artificially-inflated-traffic destinations), and
// satellite / international-network ranges. Add a region here, not to CORE, to trial it.
export const DEFAULT_SMS_EXTENDED_REGIONS = [
    // Non-EU Europe
    'UA', 'MD', 'RS', 'BA', 'ME', 'MK', 'AL', 'XK', 'TR',
    // French overseas departments
    'GP', 'MQ', 'GF', 'RE', 'YT',
    // English-speaking Africa
    'ZA', 'KE', 'GH', 'UG', 'TZ', 'ZM', 'ZW', 'BW', 'NA', 'RW', 'MW', 'MU', 'SL', 'LR', 'GM',
    // French-speaking Africa
    'SN', 'CI', 'CM', 'BJ', 'TG', 'BF', 'ML', 'NE', 'GN', 'GA', 'CG', 'CD', 'MG', 'MA',
    // English-speaking Asia
    'IN', 'PH', 'MY', 'HK',
];

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
