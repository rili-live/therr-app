import { describe, it, expect } from '@jest/globals';
import { isNonRefreshableAuthUrl } from '../../main/utilities/authRequestPaths';

describe('isNonRefreshableAuthUrl', () => {
    it.each([
        ['sign-in', '/users-service/auth'],
        ['logout', '/users-service/auth/logout'],
        ['token refresh', '/users-service/auth/token/refresh'],
        ['handoff redeem', '/users-service/auth/handoff/redeem'],
        ['phone sign-in start', '/phone/auth/start'],
        ['phone sign-in verify', '/phone/auth/verify'],
        ['phone account select', '/phone/auth/select'],
        ['phone sign-up start', '/phone/register/start'],
        ['phone sign-up verify', '/phone/register/verify'],
    ])('keeps the response interceptor off %s', (_label, url) => {
        expect(isNonRefreshableAuthUrl(url)).toEqual(true);
    });

    it('matches an absolute URL, since axios may have resolved the baseURL already', () => {
        expect(isNonRefreshableAuthUrl('https://api.therr.com/v1/users-service/auth')).toEqual(true);
    });

    it('ignores a query string and a trailing slash', () => {
        expect(isNonRefreshableAuthUrl('/users-service/auth/?foo=bar')).toEqual(true);
    });

    it.each([
        // Called by a signed-in user, so a 401 here really can mean an expired token.
        ['handoff mint', '/users-service/auth/handoff/mint'],
        ['handoff cancel', '/users-service/auth/handoff/cancel'],
        ['e-mail precheck', '/users-service/auth/email-precheck'],
        // Authenticated (absent from the gateway's unauthenticatedPaths) and answers a wrong
        // code with 400, not 401. It runs mid-onboarding while the user waits on an SMS, so a
        // 401 there is a genuinely expired token that refresh-and-retry should recover.
        ['phone code validation', '/phone/validate-code'],
        ['an ordinary read', '/users-service/users/me'],
        ['a maps read', '/maps-service/areas/search'],
    ])('leaves refresh-and-retry alone for %s', (_label, url) => {
        expect(isNonRefreshableAuthUrl(url)).toEqual(false);
    });

    it('does not match a path that merely contains a listed one mid-string', () => {
        // `endsWith` rather than `includes`, so a longer path is not swept in.
        expect(isNonRefreshableAuthUrl('/users-service/auth/something-else')).toEqual(false);
    });

    it('tolerates a request with no url', () => {
        expect(isNonRefreshableAuthUrl()).toEqual(false);
        expect(isNonRefreshableAuthUrl('')).toEqual(false);
    });
});
