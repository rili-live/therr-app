/**
 * Helpers for the single "email / phone / username" field on the sign-in screen.
 *
 * The classification here is deliberately loose: it only decides which UI to show (password
 * field vs. "text me a code"). The API gateway does the authoritative parse with
 * `awesome-phonenumber` and rejects anything that isn't E.164, so a false positive costs the
 * user one tap on "use password instead", never a failed account lookup.
 *
 * `awesome-phonenumber` is intentionally NOT imported here: it is not in TherrMobile's own
 * package.json, and pulling it through Metro's monorepo resolution for a cosmetic decision
 * would be a poor trade.
 */

// Digits plus the punctuation people actually type into a phone field.
const PHONE_ALLOWED_CHARS = /^[+()\-.\s\d]+$/;

/**
 * True when the input looks like a phone number rather than an email or username.
 *
 * Requires 7–15 digits, matching the E.164 range, so a short numeric username ("1234") and a
 * long digit string are both correctly rejected.
 */
export const isLikelyPhoneNumber = (value?: string): boolean => {
    const trimmed = (value || '').trim();

    if (!trimmed || trimmed.includes('@')) {
        return false;
    }

    if (!PHONE_ALLOWED_CHARS.test(trimmed)) {
        return false;
    }

    const digitCount = trimmed.replace(/\D/g, '').length;

    return digitCount >= 7 && digitCount <= 15;
};

/**
 * Strips display formatting so the value can be sent to the API. A leading `+` is preserved
 * because it is the only reliable signal of an explicit country code; without it the server
 * falls back to its default region.
 */
export const toDialableNumber = (value?: string): string => {
    const trimmed = (value || '').trim();
    const hasPlus = trimmed.startsWith('+');

    return `${hasPlus ? '+' : ''}${trimmed.replace(/\D/g, '')}`;
};

/**
 * Best-effort classification of a saved credential, used to label remembered profiles.
 */
export const getIdentifierType = (value?: string): 'email' | 'phone' | 'userName' => {
    if ((value || '').includes('@')) {
        return 'email';
    }

    return isLikelyPhoneNumber(value) ? 'phone' : 'userName';
};

/** Which soft keyboard the sign-in identifier field should raise. */
export type IdentifierKeyboard = 'phone-pad' | 'default';

/**
 * Picks the keyboard for the identifier field.
 *
 * Deliberately separate from `isLikelyPhoneNumber`, which needs 7+ digits before it will
 * call something a phone number. That threshold is right for deciding *which sign-in flow to
 * offer* but wrong for deciding which keyboard to raise: driving `keyboardType` off it meant
 * Android tore down the alphabet IME and replaced it with the number pad on the seventh
 * digit, mid-entry. The caller resolves this once per editing session and holds it, so the
 * keyboard never changes under the user's thumb.
 *
 * A single character can only be judged on its shape — someone who opens with a digit or `+`
 * is dialling. Anything longer (a remembered profile, a sign-up hand-off) is a complete
 * identifier and gets the real classifier, so a username like `1coolguy` is not mistaken for
 * a phone number.
 *
 * Returns `undefined` for an empty value: nothing has been typed, so there is nothing to
 * infer from and the caller should stay on its default.
 */
export const resolveIdentifierKeyboard = (value?: string): IdentifierKeyboard | undefined => {
    const trimmed = (value || '').trim();

    if (!trimmed) {
        return undefined;
    }

    if (trimmed.length === 1) {
        return /[\d+]/.test(trimmed) ? 'phone-pad' : 'default';
    }

    return getIdentifierType(trimmed) === 'phone' ? 'phone-pad' : 'default';
};

/**
 * Partially hides an email for display in the account switcher — enough to recognize your own
 * account, not enough to be useful to someone glancing at your screen.
 * `jane.doe@example.com` -> `ja•••@example.com`
 */
export const maskEmail = (email?: string): string => {
    const [localPart, domain] = (email || '').split('@');

    if (!localPart || !domain) {
        return email || '';
    }

    const visible = localPart.slice(0, Math.min(2, localPart.length));

    return `${visible}•••@${domain}`;
};

/**
 * Shows only the last four digits of a phone number: `+13175551234` -> `•••• 1234`.
 */
export const maskPhoneNumber = (phoneNumber?: string): string => {
    const digits = (phoneNumber || '').replace(/\D/g, '');

    if (digits.length < 4) {
        return phoneNumber || '';
    }

    return `•••• ${digits.slice(-4)}`;
};

/**
 * Display string for whatever kind of identifier a remembered profile holds.
 */
export const maskIdentifier = (identifier?: string): string => {
    const type = getIdentifierType(identifier);

    if (type === 'email') {
        return maskEmail(identifier);
    }
    if (type === 'phone') {
        return maskPhoneNumber(identifier);
    }

    return identifier || '';
};
