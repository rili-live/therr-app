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

// North America, the UK, and Spanish-speaking South America — where our users actually are.
// Keep in step with Twilio's Messaging Geo Permissions, which are the account-level copy of this list.
export const DEFAULT_SMS_ALLOWED_REGIONS = [
    'US', 'CA', 'MX', 'GB',
    'AR', 'BO', 'CL', 'CO', 'EC', 'PE', 'PY', 'UY', 'VE',
];

// Number types that are never a legitimate person's handset, whatever their country.
const DISALLOWED_NUMBER_TYPES = ['premium-rate', 'shared-cost', 'toll-free'];

/**
 * Reads `TWILIO_SMS_ALLOWED_REGIONS` (comma-separated ISO 3166-1 alpha-2 codes, e.g. `US,CA,MX,GB`)
 * at call time rather than module load, so it can't be silently captured before dotenv runs.
 */
export const getSmsAllowedRegions = (rawRegions = process.env.TWILIO_SMS_ALLOWED_REGIONS): string[] => {
    const regions = `${rawRegions || ''}`
        .split(',')
        .map((region) => region.trim().toUpperCase())
        .filter(Boolean);

    return regions.length ? regions : DEFAULT_SMS_ALLOWED_REGIONS;
};

/**
 * True only when `phoneNumber` parses as a valid number in an allowed region and is not a
 * premium/shared-cost/toll-free line. Fails closed: anything that doesn't parse is refused.
 * Accepts E.164 or the formatted dialect stored in `main.users.phoneNumber` (`+1 317-555-1234`),
 * but requires the `+` country code — a bare national number has no region to check.
 */
export const isSmsDestinationAllowed = (phoneNumber: string, allowedRegions = getSmsAllowedRegions()): boolean => {
    const cleaned = `${phoneNumber || ''}`.replace(/[^\d+]/g, '');

    if (!cleaned.startsWith('+')) {
        return false;
    }

    const parsed = parsePhoneNumber(cleaned);

    if (!parsed.valid || !parsed.regionCode) {
        return false;
    }

    if (DISALLOWED_NUMBER_TYPES.includes(`${parsed.type}`)) {
        return false;
    }

    return allowedRegions.includes(parsed.regionCode);
};

/** Error message a send site rejects with when the destination fails `isSmsDestinationAllowed`. */
export const SMS_DESTINATION_NOT_ALLOWED = 'SMS destination is not in an allowed region';
