import { parsePhoneNumber } from 'awesome-phonenumber';
import normalizePhoneNumber from 'therr-js-utilities/normalize-phone-number';

/**
 * Turns whatever a user typed into the two forms the passwordless phone flows need.
 *
 * Split out of `router.ts` (like `./verificationCodes`) so it can be unit tested without
 * standing up the router's Twilio and Redis clients.
 *
 * ## Why two forms
 *
 * `normalizePhoneNumber` does NOT return E.164 despite the name — it returns a *display*
 * format: `+13175551234` becomes `"+1 317-555-1234"`. That formatted string is nonetheless
 * the de-facto canonical value across this codebase: it is what the existing phone-verification
 * flow writes to `main.users.phoneNumber`, and `UsersStore.getByPhoneNumber` /
 * `getAllByPhoneNumber` re-derive it from their input before the equality match. Any lookup
 * that wants to find an existing account has to speak that dialect.
 *
 * Twilio, meanwhile, wants real E.164 for its `to` field.
 *
 * So: `canonical` for anything that reaches the database, `e164` for Twilio and for cache keys
 * (where a stable, whitespace-free identifier is worth more than matching the DB's format).
 */

/**
 * Region assumed when the caller omits a country code. Matches the assumption already baked
 * into `normalizePhoneNumber`, which this must agree with or the two would canonicalize the
 * same input differently. Clients should send a `+`-prefixed number wherever they can — the
 * mobile `PhoneNumberInput` does — and a non-US number without one is rejected rather than
 * silently reinterpreted as American.
 */
export const DEFAULT_REGION_CODE = 'US';

export interface ICanonicalPhoneNumber {
    /**
     * The form `main.users.phoneNumber` is stored and queried in, e.g. `"+1 317-555-1234"`.
     * Send this to the users-service and embed it in the phone-verification token.
     */
    canonical: string;
    /** True E.164, e.g. `"+13175551234"`. For Twilio and for Redis keys. */
    e164: string;
}

/**
 * Parses and canonicalizes a submitted phone number, or returns `undefined` when it isn't a
 * valid number. Accepts any punctuation a human might type — `+1 (317) 555-1234`,
 * `317-555-1234`, `+13175551234` all converge on the same pair.
 */
const canonicalizePhoneNumber = (rawPhoneNumber: any): ICanonicalPhoneNumber | undefined => {
    const cleaned = `${rawPhoneNumber || ''}`.trim().replace(/\s/g, '');

    if (!cleaned) {
        return undefined;
    }

    // An explicit country code always wins; only fall back to the default region without one.
    const parsed = cleaned.startsWith('+')
        ? parsePhoneNumber(cleaned)
        : parsePhoneNumber(cleaned, { regionCode: DEFAULT_REGION_CODE });

    if (!parsed.valid) {
        return undefined;
    }

    const e164 = parsed.number.e164;

    return {
        canonical: normalizePhoneNumber(e164),
        e164,
    };
};

export default canonicalizePhoneNumber;
