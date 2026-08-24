import {
    body,
    oneOf,
} from 'express-validator';

export const authenticateUserTokenValidation = [
    body('idToken').exists().isString(),
];

export const authenticateUserValidation = [
    body('rememberMe').optional().isBoolean(),
    // Sent when an existing account signs in straight after a Stripe checkout — the dashboard's
    // PaymentComplete redirects to `/login?paymentSessionId=`, and users-service reads it off the
    // body to grant the plan's access level on the session it is about to issue.
    // checkFalsy, not a bare .optional(): the dashboard builds the body with
    // `urlParams.get('paymentSessionId')`, which yields **null** on an ordinary login rather than
    // undefined. A bare .optional() only skips undefined, so isString() would run against null and
    // 400 every sign-in that did not come from a checkout.
    body('paymentSessionId').optional({ checkFalsy: true }).isString(),
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
