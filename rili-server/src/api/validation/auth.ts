import {
    body,
    param,
    header,
    query,
    validationResult,
} from 'express-validator/check';

export const authenticateUserValidation = [
    body('password').exists().isString().isLength({ min: 8 }),
    body('userName').exists().isString(),
    body('rememberMe').optional().isString(),
];
