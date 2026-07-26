import { body } from 'express-validator';

/**
 * `isMobilePhone('any')` is intentionally the only shape check here — the router
 * runs `canonicalizePhoneNumber` and rejects anything that doesn't parse as a valid
 * number, which is the authoritative gate. This layer just keeps obvious junk from
 * reaching Redis/Twilio.
 *
 * The two gates are not nested — they disagree in both directions, so a number must
 * satisfy both to get through:
 *   - `isMobilePhone` rejects landlines and is whitespace-sensitive for some locales
 *     (`+44 20 7946 0958` and `+44 7911 123456` both fail here, `+447911123456` passes),
 *     where `canonicalizePhoneNumber` accepts all three.
 *   - `isMobilePhone` accepts Ofcom's fictional-drama range (`+44 7700 900123`), which
 *     libphonenumber — and therefore `canonicalizePhoneNumber` — marks invalid.
 *
 * Clients should submit compact E.164 to stay inside the intersection.
 */
export const phoneAuthStartValidation = [
    body('phoneNumber').exists().isString().isMobilePhone('any'),
];

export const phoneAuthVerifyValidation = [
    body('phoneNumber').exists().isString().isMobilePhone('any'),
    body('verificationCode')
        .exists()
        .isString()
        .isLength({ min: 6, max: 6 })
        .isNumeric(),
    body('rememberMe').optional().isBoolean(),
];

export const phoneAuthSelectValidation = [
    body('phoneVerificationToken').exists().isString(),
    body('userId').exists().isUUID(4),
    body('rememberMe').optional().isBoolean(),
];
