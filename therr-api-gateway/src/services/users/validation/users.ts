import {
    body,
    oneOf,
    param,
    query,
} from 'express-validator';
import isValidSignupAge, { MINIMUM_SIGNUP_AGE } from 'therr-js-utilities/is-valid-signup-age';

export const createUserValidation = [
    // checkFalsy: SSO/dashboard registration may omit phone by sending ''. A bare .optional()
    // only skips undefined/null, so '' would fail isMobilePhone and 400 the signup. See the
    // same fix on updateUserValidation below.
    body('phoneNumber').optional({ checkFalsy: true }).isMobilePhone('any'),
    body('email').exists().isEmail().normalizeEmail(),
    body('password').exists().isString().isLength({ min: 8 }), // TODO: RMOBILE-26: Centralize password requirements
    // Birthdate is optional at the API boundary because SSO providers do not return it
    // (those users are prompted later). When supplied it must meet the minimum signup age.
    body('settingsBirthdate')
        .optional({ nullable: true })
        .isISO8601()
        .withMessage('invalid-birthdate')
        .bail()
        .custom((value) => isValidSignupAge(value))
        .withMessage(`must-be-at-least-${MINIMUM_SIGNUP_AGE}`),
    body('userName').optional().isString(),
    body('isBusinessAccount').optional().isBoolean(),
    body('isCreatorAccount').optional().isBoolean(),
    body('isDashboardRegistration').optional().isBoolean(),
    body('settingsEmailMarketing').optional().isBoolean(),
    body('settingsEmailBusMarketing').optional().isBoolean(),
    // Locale chosen on the pre-login language switcher (mobile/web). Persisted to the
    // new account so the user's first emails and app session match their selected language.
    body('settingsLocale').optional().isString().isIn(['en-us', 'es', 'fr-ca', 'en', 'fr']),
    body('inviteCode').optional().isString(),
    // Magic invite-link token. When present and valid, registration trusts the
    // contact channel the invite was delivered on (email -> email verified,
    // SMS -> phone verified), auto-accepts the invite, and connects the users.
    body('inviteToken').optional().isUUID(4),
    body('activationCode').optional().isString(),
    body('paymentSessionId').optional().isString(),
];

export const changePasswordValidation = [
    body('oldPassword').exists().isString(),
    body('newPassword').exists().isString(),
    body('email').exists().isEmail().normalizeEmail(),
    body('userName').exists().isString(),
];

export const forgotPasswordValidation = [
    body('email').exists().isEmail().normalizeEmail(),
    body('isDashboardRegistration').optional().isBoolean(),
];

export const searchUsersValidation = [
    body('ids').optional(),
    body('query').optional().isString(),
    body('queryColumnName').optional().isIn(['firstName', 'lastName', 'userName']),
    body('limit').optional(),
    body('offset').optional(),
    body('withMedia').isBoolean().optional(),
];

export const verifyUserAccountValidation = [
    oneOf([
        body('type').exists().isString().equals('email'),
        body('type').exists().isString().equals('mobile'),
    ]),
    param('token').exists().isString(),
];

export const resendVerificationValidation = [
    oneOf([
        body('type').exists().isString().equals('email'),
        body('type').exists().isString().equals('mobile'),
    ]),
    body('email').exists().isEmail().normalizeEmail(),
    body('isDashboardRegistration').optional().isBoolean(),
];

export const updateUserValidation = [
    param('id').exists().isUUID(4),
    // checkFalsy so SSO users (whose stored email/phoneNumber is the empty string) can still
    // update their profile. The deployed mobile app sends `email`/`phoneNumber` from
    // user.details — Apple/Google SSO accounts persist these as '' — and a bare `.optional()`
    // only skips undefined/null, so an empty string would fail isEmail/isMobilePhone and 400
    // the entire update (regression for un-updatable app versions).
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('phoneNumber').optional({ checkFalsy: true }).isMobilePhone('any'),
    body('userName').optional().isString().trim()
        .isLength({ max: 50 }),
    body('firstName').optional().isString().trim()
        .isLength({ max: 100 }),
    body('lastName').optional().isString().trim()
        .isLength({ max: 100 }),
    body('isBusinessAccount').optional().isBoolean(),
    body('isCreatorAccount').optional().isBoolean(),
    body('settingsEmailMarketing').optional().isBoolean(),
    body('settingsEmailBusMarketing').optional().isBoolean(),
    body('settingsIsProfilePublic').optional().isBoolean(),
    body('settingsPushMarketing').optional().isBoolean(),
    body('settingsPushBackground').optional().isBoolean(),
    body('shouldSendPushNotification').optional().isBoolean(),
];

export const blockUserValidation = [
    param('id').exists().isUUID(4),
];

export const reportUserValidation = [
    param('id').exists().isUUID(4),
    body('reason').optional().isString().trim()
        .isLength({ max: 500 }),
    query('reportType').optional().isString(),
];

export const deleteUserValidation = [
    param('id').exists().isUUID(4),
];

export const createNotificationValidation = [
    body('userId').exists().isUUID(4),
    body('type').exists().isString().isLength({ max: 100 }),
    body('associationId').optional().isUUID(4),
    body('isUnread').optional().isBoolean(),
    body('messageLocaleKey').optional().isString().isLength({ max: 200 }),
    body('messageParams').optional().isObject(),
];
