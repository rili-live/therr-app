import { body } from 'express-validator';

/**
 * `isMobilePhone('any')` is intentionally the only shape check here — the router
 * re-normalizes to E.164 with `normalizePhoneNumber` and rejects anything that
 * doesn't come back as a valid international number, which is the authoritative
 * gate. This layer just keeps obvious junk from reaching Redis/Twilio.
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
