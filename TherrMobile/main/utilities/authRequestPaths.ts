/**
 * Endpoints where a 401 is the endpoint's *answer*, not an expired session.
 *
 * A wrong password, a spent SMS code, an unverified account, a stale handoff code — every one
 * of these comes back 401, and none of them is fixed by refreshing a token. Running the
 * response interceptor's refresh-and-retry path on them swallows the answer two different ways:
 *
 *   - Signed out (the normal case on these screens) there is no refresh token, so the queued
 *     request is rejected ~9s later — after two 3s retries — with a bare `Error` carrying no
 *     `statusCode`. The sign-in form waiting on it then has nothing to key its message off,
 *     which is why a wrong password used to spin and then silently do nothing.
 *   - With a stale refresh token still on the device the refresh *succeeds*, the wrong
 *     password is replayed, the second 401 trips the retry branch, and the user is logged out
 *     instead of being told their password was wrong.
 *
 * `/auth/handoff/mint` and `/auth/handoff/cancel` are deliberately absent: those are called by
 * an already-signed-in user, where a 401 really can mean an expired token worth refreshing.
 */
export const NON_REFRESHABLE_AUTH_PATHS = [
    '/users-service/auth',                  // password + SSO sign-in
    '/users-service/auth/logout',
    '/users-service/auth/token/refresh',
    '/users-service/auth/handoff/redeem',   // exchanges a handoff code for a fresh session
    '/phone/auth/start',                    // passwordless sign-in
    '/phone/auth/verify',
    '/phone/auth/select',
    '/phone/register/start',                // passwordless sign-up
    '/phone/register/verify',
    '/phone/validate-code',
];

/**
 * Matched on the path — and on the whole of it, not a substring — so it holds whether axios
 * was handed a relative URL or a full one, and so a longer path that merely starts with one of
 * these (`/users-service/auth/handoff/mint`) is not swept in by accident.
 */
export const isNonRefreshableAuthUrl = (url = '') => {
    const path = (url || '').split('?')[0].replace(/\/+$/, '');

    return NON_REFRESHABLE_AUTH_PATHS.some((authPath) => path === authPath || path.endsWith(authPath));
};

export default isNonRefreshableAuthUrl;
