import { body } from 'express-validator';

/**
 * `isMobilePhone('any')` is intentionally the only shape check here — the router
 * runs `canonicalizePhoneNumber` and rejects anything that doesn't parse as a valid
 * number, which is the authoritative gate. This layer just keeps obvious junk from
 * reaching Redis/Twilio.
 *
 * Note this check is strictly *narrower* than the router's: `isMobilePhone` rejects
 * landlines and is whitespace-sensitive for some locales (`+44 7700 900123` fails
 * where `+447700900123` passes), so a number can satisfy `canonicalizePhoneNumber`
 * and still be refused here. Clients should submit compact E.164.
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
