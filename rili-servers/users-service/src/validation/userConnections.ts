import {
    body,
    oneOf,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createUserConnectionValidation = [
    body('requestingUserId').isNumeric().exists(),
    oneOf([
        body('requestingUserId').exists(),
        body('acceptingUserPhoneNumber').exists().isString().isMobilePhone('any'),
        body('acceptingUserPhoneEmail')
            .exists()
            .isString()
            .isEmail()
            .normalizeEmail(),
    ]),
];
