import {
    body,
    oneOf,
    param,
} from 'express-validator';
import isValidSignupAge, { MINIMUM_SIGNUP_AGE } from 'therr-js-utilities/is-valid-signup-age';

export const createUserValidation = [
    body('phoneNumber').optional().isMobilePhone('any'),
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
    body('inviteCode').optional().isString(),
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
    body('queryColumnName').optional().isIn(['firstName', 'lastName', 'usersName']),
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
