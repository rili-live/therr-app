import {
    body,
    param,
    header,
    query,
    validationResult,
} from 'express-validator/check';

export const createUserValidation = [
    body('phoneNumber').exists().isMobilePhone('any'),
    body('firstName').exists().isString(),
    body('lastLame').exists().isString(),
    body('userName').exists().isString(),
];
