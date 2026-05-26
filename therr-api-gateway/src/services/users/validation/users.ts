import {
    body,
    oneOf,
    param,
    query,
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
    body('email').optional().isEmail().normalizeEmail(),
    body('phoneNumber').optional().isMobilePhone('any'),
    body('userName').optional().isString().trim().isLength({ max: 50 }),
    body('firstName').optional().isString().trim().isLength({ max: 100 }),
    body('lastName').optional().isString().trim().isLength({ max: 100 }),
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
    body('reason').optional().isString().trim().isLength({ max: 500 }),
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
