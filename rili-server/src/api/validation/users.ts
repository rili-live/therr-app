import {
    body,
    param,
    header,
    query,
    validationResult,
} from 'express-validator/check';

export const createUserValidation = [
    body('phoneNumber').exists().isMobilePhone('any'),
    body('email').exists().isString(),
    body('firstName').optional().isString(),
    body('password').exists().isString().isLength({ min: 8 }),
    body('lastName').exists().isString(),
    body('userName').exists().isString(),
];
