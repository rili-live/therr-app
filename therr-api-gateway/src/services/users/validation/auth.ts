import {
    body,
    oneOf,
} from 'express-validator/check'; // eslint-disable-line import/extensions

export const authenticateUserTokenValidation = [
    body('idToken').exists().isString(),
];

export const authenticateUserValidation = [
    body('rememberMe').optional().isString(),
    oneOf([
        [
            body('userName').exists().isString(),
            body('password').exists().isString().isLength({ min: 8 }),
        ],
        [
            body('isSSO').exists().isBoolean(),
            body('ssoProvider').exists().isString(),
            body('nonce').optional().isString(),
            body('idToken').exists().isString(),
            body('userFirstName').optional().isString(),
            body('userLastName').optional().isString(),
            body('userEmail').exists().isString().isEmail()
                .normalizeEmail(),
        ],
    ]),
];

// TODO: RMOBILE-26: Handle SSO logout
export const logoutUserValidation = [
    body('userName').exists().isString(),
];
