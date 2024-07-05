import {
    body,
    oneOf,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createUserConnectionValidation = [
    body('requestingUserId').isString().exists(),
    body('requestingUserFirstName').isString().exists(),
    body('requestingUserLastName').isString().exists(),
    body('requestingUserEmail').isString().exists(),
    oneOf([
        body('acceptingUserPhoneNumber')
            .exists()
            .isString()
            .isMobilePhone('any'),
        body('acceptingUserEmail')
            .exists()
            .isString()
            .isEmail()
            .normalizeEmail(),
    ]),
];

export const inviteConnectionsValidation = [
    body('requestingUserId').isString().exists(),
    body('requestingUserFirstName').isString().exists(),
    body('requestingUserLastName').isString().exists(),
    body('requestingUserEmail').isString().exists(),
    body('inviteList')
        .exists()
        .isArray(),
];

export const updateUserConnectionValidation = [
    body('otherUserId').isString().exists(),
];

export const updateUserConnectionTypeValidation = [
    ...updateUserConnectionValidation,
    body('type').isNumeric().exists(),
];
