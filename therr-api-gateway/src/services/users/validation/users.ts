import {
    body,
    param,
    header,
    query,
    validationResult,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const createUserValidation = [
    body('phoneNumber').exists().isMobilePhone('any'),
    body('email').exists().isString(),
    body('password').exists().isString().isLength({ min: 8 }),
    body('userName').exists().isString(),
];
