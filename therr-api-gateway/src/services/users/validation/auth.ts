import {
    body,
    oneOf,
} from 'express-validator';

export const authenticateUserTokenValidation = [
    body('idToken').exists().isString(),
];

export const authenticateUserValidation = [
    body('rememberMe').optional().isBoolean(),
    oneOf([
        [
            body('userName').exists().isString(),
            body('password').exists().isString().isLength({ min: 8 }),
        ],
        [
            body('isSSO').exists().isBoolean(),
            body('ssoProvider').exists().isString(),
            body('ssoPlatform').optional().isString(),
            body('nonce').optional({
                nullable: true,
            }),
            body('idToken').exists().isString(),
            body('userFirstName').optional().isString(),
            body('userLastName').optional().isString(),
            // checkFalsy: Apple SSO frequently returns no email on repeat logins, so clients
            // send userEmail: ''. A bare .optional() would run isEmail on '' and 400 the login.
            body('userEmail').optional({ checkFalsy: true }).isString().isEmail()
                .normalizeEmail(),
        ],
    ]),
];

// TODO: RMOBILE-26: Handle SSO logout
export const logoutUserValidation = [
    body('userName').exists().isString(),
];
