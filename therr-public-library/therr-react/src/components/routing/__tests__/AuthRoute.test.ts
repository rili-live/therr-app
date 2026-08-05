import { getRedirectTo } from '../AuthRoute';

/**
 * A gated route used to redirect to a bare `redirectPath`, discarding where the visitor was
 * headed. A deep link into a gated page — mobile's API-access screen opening the dashboard's
 * /settings/api-keys in a browser with no session — therefore always ended on the default
 * landing page, and the user had to find the page themselves.
 */
describe('getRedirectTo', () => {
    describe('when the visitor has no session', () => {
        const unauthenticated = { isUserUnauthenticated: true, redirectPath: '/login' };

        it('preserves the gated path so the login detour can land them there', () => {
            expect(getRedirectTo({
                ...unauthenticated,
                location: { pathname: '/settings/api-keys', search: '' },
            })).toEqual({
                pathname: '/login',
                search: '?returnTo=%2Fsettings%2Fapi-keys',
            });
        });

        it('preserves the gated path\'s own query string', () => {
            expect(getRedirectTo({
                ...unauthenticated,
                location: { pathname: '/settings', search: '?tab=keys' },
            })).toEqual({
                pathname: '/login',
                search: '?returnTo=%2Fsettings%3Ftab%3Dkeys',
            });
        });

        it('does not point returnTo at the redirect target itself', () => {
            expect(getRedirectTo({
                ...unauthenticated,
                location: { pathname: '/login', search: '' },
            })).toEqual({ pathname: '/login' });
        });

        it('falls back to the bare path when no usable location was injected', () => {
            expect(getRedirectTo({ ...unauthenticated, location: undefined })).toEqual({ pathname: '/login' });
            expect(getRedirectTo({ ...unauthenticated, location: {} })).toEqual({ pathname: '/login' });
            expect(getRedirectTo({ ...unauthenticated, location: { pathname: '' } })).toEqual({ pathname: '/login' });
        });
    });

    describe('when the visitor is authenticated but not authorized', () => {
        // Login forwards an already-authenticated visitor straight to `returnTo`. Attaching
        // one here would send them back to the route that just rejected them, which bounces
        // to /login again — an infinite loop. The bare path is the terminating case.
        it('omits returnTo so the redirect cannot loop', () => {
            expect(getRedirectTo({
                isUserUnauthenticated: false,
                location: { pathname: '/manage-spaces', search: '' },
                redirectPath: '/login',
            })).toEqual({ pathname: '/login' });
        });

        it('omits returnTo for the create-profile gate too', () => {
            expect(getRedirectTo({
                isUserUnauthenticated: false,
                location: { pathname: '/settings/api-keys', search: '' },
                redirectPath: '/create-profile',
            })).toEqual({ pathname: '/create-profile' });
        });
    });
});
