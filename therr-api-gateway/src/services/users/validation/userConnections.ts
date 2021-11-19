import {
    body,
    oneOf,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createUserConnectionValidation = [
    body('requestingUserId').isString().exists(),
    body('requestingUserFirstName').isNumeric().exists(),
    body('requestingUserLastName').isNumeric().exists(),
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

export const updateUserConnectionValidation = [
    body('otherUserId').isString().exists(),
];
