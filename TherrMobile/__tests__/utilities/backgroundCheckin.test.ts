// Note: import explicitly to use the types shipped with jest.
import {
    it, describe, expect, beforeEach, afterEach, jest,
} from '@jest/globals';

/**
 * One-press check-in from a notification action.
 *
 * This runs in Notifee's headless background context, where `initInterceptors`
 * (main/interceptors.ts) has never run — so `axios.defaults.baseURL` is unset
 * and the interceptor that attaches `authorization` from the Redux store was
 * never registered. A check-in built on `HabitCheckinsService` therefore works
 * when the app happens to be warm and silently no-ops when it is not, which is
 * the opposite of what a tray button is for.
 *
 * These pin the two things that make it work cold: reading the session straight
 * from SecureStorage, and reporting every failure so the caller can fall back
 * to opening the app rather than leaving the user with a button that did
 * nothing.
 */

const mockGetItem = jest.fn();
const mockFetch = jest.fn();

jest.mock('../../main/utilities/SecureStorage', () => ({
    __esModule: true,
    default: { getItem: (...args: any[]) => mockGetItem(...args) },
}));

jest.mock('../../main/utilities/getConfig', () => ({
    __esModule: true,
    default: () => ({ baseApiGatewayRoute: 'https://api.example.com/v1' }),
}));

jest.mock('../../main/config/brandConfig', () => ({
    __esModule: true,
    CURRENT_BRAND_VARIATION: 'habits',
    BRAND_DISPLAY_NAME: 'Friends with Habits',
    default: { brandVariation: 'habits' },
}));

const SESSION = JSON.stringify({ id: 'user-1', idToken: 'token-abc' });
const SETTINGS = JSON.stringify({ locale: 'fr-ca' });

const loadModule = () => require('../../main/utilities/backgroundCheckin');

const stubSession = (user: string | null, settings: string | null = SETTINGS) => {
    mockGetItem.mockImplementation((key: any) => {
        if (key === 'therrUser') return Promise.resolve(user);
        if (key === 'therrUserSettings') return Promise.resolve(settings);
        return Promise.resolve(null);
    });
};

describe('backgroundCheckin', () => {
    beforeEach(() => {
        jest.resetModules();
        mockGetItem.mockReset();
        mockFetch.mockReset();
        (global as any).fetch = mockFetch;
    });

    afterEach(() => {
        delete (global as any).fetch;
    });

    it('posts the check-in with the stored session credentials', async () => {
        stubSession(SESSION);
        mockFetch.mockResolvedValue({ ok: true } as never);

        const completeCheckinInBackground = loadModule().default;
        const result = await completeCheckinInBackground({ habitGoalId: 'goal-1', pactId: 'pact-1' });

        expect(result.didCheckIn).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        const [url, init] = mockFetch.mock.calls[0] as any[];
        expect(url).toBe('https://api.example.com/v1/users-service/habits/checkins');
        expect(init.method).toBe('POST');
        expect(init.headers.authorization).toBe('Bearer token-abc');
        expect(init.headers['x-userid']).toBe('user-1');
        expect(init.headers['x-brand-variation']).toBe('habits');
        // The locale travels too, so the server renders any follow-on
        // notification in the language the user reads.
        expect(init.headers['x-localecode']).toBe('fr-ca');
        expect(JSON.parse(init.body)).toEqual({
            habitGoalId: 'goal-1',
            pactId: 'pact-1',
            status: 'completed',
        });
    });

    it('omits pactId rather than sending it undefined', async () => {
        // The handler resolves the active pacts backing the goal itself when
        // none is given, which is correct for a habit held through several.
        stubSession(SESSION);
        mockFetch.mockResolvedValue({ ok: true } as never);

        await loadModule().default({ habitGoalId: 'goal-1' });

        const [, init] = mockFetch.mock.calls[0] as any[];
        expect(JSON.parse(init.body)).toEqual({ habitGoalId: 'goal-1', status: 'completed' });
    });

    it('reports failure without calling the API when there is no session', async () => {
        stubSession(null);

        const result = await loadModule().default({ habitGoalId: 'goal-1' });

        expect(result.didCheckIn).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('reports failure when the token is missing from a stored user', async () => {
        // A logged-out session leaves the key present but empty. There is no
        // refresh flow in the headless context, so this must fall back to the
        // app rather than attempting one.
        stubSession(JSON.stringify({ id: 'user-1' }));

        const result = await loadModule().default({ habitGoalId: 'goal-1' });

        expect(result.didCheckIn).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('reports failure when the notification named no habit', async () => {
        stubSession(SESSION);

        const result = await loadModule().default({ habitGoalId: '' });

        expect(result.didCheckIn).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('reports a rejected request as failure, not success', async () => {
        // An expired token comes back 401. Reporting it as success would leave
        // the user with a "Checked In" notification and no check-in.
        stubSession(SESSION);
        mockFetch.mockResolvedValue({ ok: false, status: 401 } as never);

        expect((await loadModule().default({ habitGoalId: 'goal-1' })).didCheckIn).toBe(false);
    });

    it('survives a network failure', async () => {
        stubSession(SESSION);
        mockFetch.mockRejectedValue(new Error('Network request failed') as never);

        expect((await loadModule().default({ habitGoalId: 'goal-1' })).didCheckIn).toBe(false);
    });

    it('returns a usable locale even when storage is unreadable', async () => {
        // The caller renders its confirmation with this; defaulting keeps a
        // Keychain miss from producing an untranslated notification.
        mockGetItem.mockRejectedValue(new Error('keychain locked') as never);

        const result = await loadModule().default({ habitGoalId: 'goal-1' });

        expect(result.didCheckIn).toBe(false);
        expect(result.locale).toBe('en-us');
    });

    it('tolerates corrupt stored JSON', async () => {
        stubSession('not json at all', 'also not json');

        const result = await loadModule().default({ habitGoalId: 'goal-1' });

        expect(result.didCheckIn).toBe(false);
        expect(result.locale).toBe('en-us');
    });
});
