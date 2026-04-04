import {
    body,
    oneOf,
    param,
} from 'express-validator';

export const createUserValidation = [
    body('phoneNumber').optional().isMobilePhone('any'),
    body('email').exists().isEmail().normalizeEmail(),
    body('password').exists().isString().isLength({ min: 8 }), // TODO: RMOBILE-26: Centralize password requirements
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
