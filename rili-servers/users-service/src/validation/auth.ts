import {
    body,
    param,
    header,
    query,
    validationResult,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const authenticateUserTokenValidation = [
    body('idToken').exists().isString(),
];

export const authenticateUserValidation = [
    body('password').exists().isString().isLength({ min: 8 }),
    body('userName').exists().isString(),
    body('rememberMe').optional().isString(),
];

export const logoutUserValidation = [
    body('userName').exists().isString(),
];
