import * as express from 'express';
import {
    cancelHandoff,
    emailPrecheck,
    login,
    loginWithVerifiedPhone,
    logout,
    mintHandoff,
    phoneAccountLookup,
    redeemHandoff,
    refreshToken,
    verifyToken,
} from '../handlers/auth';

const router = express.Router();

// Authenticate user
router.post('/', login);

// Logout user
router.post('/logout', logout);

// Refresh access token
router.post('/token/refresh', refreshToken);

// Verify user token (after login)
router.post('/user-token/validate', verifyToken);

// Pre-check an email (does NOT confirm account existence). Returns a hint the client uses to render
// the next step (password field, SSO button, magic link, sign up).
router.post('/email-precheck', emailPrecheck);

// Passwordless phone auth (internal — the API gateway calls these after it has validated a
// texted one-time code). `/phone/lookup` answers "which accounts use this number"; `/phone`
// mints the session for the chosen one.
router.post('/phone/lookup', phoneAccountLookup);
router.post('/phone', loginWithVerifiedPhone);

// Cross-app handoff (first-party single-sign-on between sister apps).
router.post('/handoff/mint', mintHandoff);
router.post('/handoff/redeem', redeemHandoff);
router.post('/handoff/cancel', cancelHandoff);

export default router;
