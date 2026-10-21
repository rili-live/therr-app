jest.mock('@react-native-firebase/app', () => ({ getApp: jest.fn(() => ({ name: '[DEFAULT]' })) }));

let getToken: jest.Mock;
let initializeAppCheck: jest.Mock;

// A fresh registry per test, so the memoized App Check instance never leaks between cases. The
// native-module mock is re-required from the same registry the module's lazy `require` will use.
const loadAppCheck = (os: 'android' | 'ios' = 'android'): typeof import('../main/utilities/appCheck') => {
    jest.resetModules();
    require('react-native').Platform.OS = os;
    ({ getToken, initializeAppCheck } = require('@react-native-firebase/app-check'));
    return require('../main/utilities/appCheck');
};

describe('appCheck', () => {

    describe('needsAppCheckToken', () => {
        const { needsAppCheckToken } = loadAppCheck();

        it('matches only the routes that send a verification text', () => {
            expect(needsAppCheckToken('/phone/register/start')).toBe(true);
            expect(needsAppCheckToken('/phone/auth/start')).toBe(true);
            expect(needsAppCheckToken('/phone/verify')).toBe(true);
            expect(needsAppCheckToken('https://api.therr.com/v1/phone/auth/start?x=1')).toBe(true);
        });

        it('does not sweep in code verification or unrelated routes', () => {
            expect(needsAppCheckToken('/phone/auth/verify')).toBe(false);
            expect(needsAppCheckToken('/phone/register/verify')).toBe(false);
            expect(needsAppCheckToken('/phone/validate-code')).toBe(false);
            expect(needsAppCheckToken('/users-service/auth')).toBe(false);
            expect(needsAppCheckToken(undefined)).toBe(false);
        });
    });

    describe('getAppCheckToken', () => {
        it('returns the token on Android, initializing App Check once with auto-refresh off', async () => {
            const { getAppCheckToken } = loadAppCheck();

            expect(await getAppCheckToken()).toBe('mockAppCheckToken');
            expect(await getAppCheckToken()).toBe('mockAppCheckToken');
            expect(initializeAppCheck).toHaveBeenCalledTimes(1);
            expect(initializeAppCheck.mock.calls[0][1]).toMatchObject({ isTokenAutoRefreshEnabled: false });
        });

        it('sends no token on iOS until App Attest is configured', async () => {
            const { getAppCheckToken } = loadAppCheck('ios');

            expect(await getAppCheckToken()).toBeUndefined();
            expect(initializeAppCheck).not.toHaveBeenCalled();
        });

        it('swallows a token failure, so sign-in falls back to the strict lane instead of breaking', async () => {
            const { getAppCheckToken } = loadAppCheck();
            getToken.mockRejectedValueOnce(new Error('Play Integrity unavailable'));

            expect(await getAppCheckToken()).toBeUndefined();
        });

        it('retries initialization after it fails once', async () => {
            const { getAppCheckToken } = loadAppCheck();
            initializeAppCheck.mockRejectedValueOnce(new Error('not configured'));

            expect(await getAppCheckToken()).toBeUndefined();
            expect(await getAppCheckToken()).toBe('mockAppCheckToken');
        });

        it('gives up after the timeout rather than holding the request', async () => {
            jest.useFakeTimers();
            const { getAppCheckToken } = loadAppCheck();
            getToken.mockReturnValueOnce(new Promise(() => {}));

            const pending = getAppCheckToken();
            await jest.advanceTimersByTimeAsync(5000);

            expect(await pending).toBeUndefined();
            jest.useRealTimers();
        });
    });
});
