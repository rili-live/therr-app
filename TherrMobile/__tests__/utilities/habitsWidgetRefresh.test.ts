import {
    it, describe, expect, jest, beforeEach, afterEach,
} from '@jest/globals';
import { NativeModules, Platform } from 'react-native';

/**
 * The home-screen widget's background refresh — the widget's only source of fresh data while
 * the app is closed.
 *
 * It runs in the headless JS context with no Redux store and no axios interceptor, so these pin
 * what makes it work cold (the stored session on every request), what keeps it honest (today's
 * count derived the way the dashboard derives it, so the widget and the screen agree), and what
 * keeps a bad refresh from being worse than none: every failure publishes nothing and ends the
 * widget's "Refreshing…" state, never a partial or blank snapshot.
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

jest.mock('../../main/utilities/deviceTimeZone', () => ({
    __esModule: true,
    default: () => 'America/Chicago',
}));

const SESSION = JSON.stringify({ id: 'me', idToken: 'token-abc' });
const SETTINGS = JSON.stringify({ locale: 'en-us' });

const loadModule = () => require('../../main/utilities/habitsWidgetRefresh');

const stubSession = (user: string | null, settings: string | null = SETTINGS) => {
    mockGetItem.mockImplementation((key: any) => {
        if (key === 'therrUser') return Promise.resolve(user);
        if (key === 'therrUserSettings') return Promise.resolve(settings);
        return Promise.resolve(null);
    });
};

const jsonResponse = (data: any, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
});

const friendsBoard = {
    entries: [
        { rank: 1, userName: 'maya', points: 610, dailyStreak: 30, isRequestingUser: false },
        { rank: 2, userName: 'me', points: 420, dailyStreak: 12, isRequestingUser: true },
    ],
    currentUser: { userId: 'me', rank: 2, points: 420, dailyStreak: 12 },
    periodEnd: '2026-09-28',
};
const lonelyBoard = {
    entries: [{ rank: 1, userName: 'me', points: 420, isRequestingUser: true }],
    currentUser: { userId: 'me', rank: 1, points: 420, dailyStreak: 12 },
    periodEnd: '2026-09-28',
};
const globalBoard = {
    ...friendsBoard,
    currentUser: { userId: 'me', rank: 48, points: 420, dailyStreak: 12 },
};

// Three goals: one with a live pact, one with no pact at all (live), one whose only pact is
// still pending (not checkin-able, so not in the widget's denominator).
const goals = [{ id: 'g-live' }, { id: 'g-solo' }, { id: 'g-pending' }];
const activePacts = [{ id: 'p1', habitGoalId: 'g-live', status: 'active', members: [] }];
const pacts = [
    ...activePacts,
    { id: 'p2', habitGoalId: 'g-pending', status: 'pending', members: [] },
];
const todayCheckins = [
    { habitGoalId: 'g-live', status: 'completed' },
    { habitGoalId: 'g-pending', status: 'completed' },
    { habitGoalId: 'g-solo', status: 'skipped' },
];

/** Answers each endpoint the refresh calls; `overrides` swap individual answers. */
const stubApi = (overrides: Record<string, any> = {}) => {
    const answers: Record<string, any> = {
        'leaderboards?scope=connections': jsonResponse(friendsBoard),
        'leaderboards?scope=global': jsonResponse(globalBoard),
        'checkins/today': jsonResponse(todayCheckins),
        'habits/goals': jsonResponse(goals),
        'pacts/active': jsonResponse(activePacts),
        'habits/pacts': jsonResponse(pacts),
        'user-habits': jsonResponse({ userHabits: [] }),
        ...overrides,
    };
    mockFetch.mockImplementation((url: any) => {
        const key = Object.keys(answers).find((fragment) => String(url).includes(fragment));
        if (!key) {
            return Promise.reject(new Error(`unexpected request ${url}`));
        }
        const answer = answers[key];
        return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    });
};

const calledUrls = () => mockFetch.mock.calls.map(([url]: any) => String(url));

describe('refreshHabitsWidgetInBackground', () => {
    let setSnapshot: jest.Mock<any>;
    let finishRefresh: jest.Mock<any>;
    let hasWidgets: jest.Mock<any>;

    beforeEach(() => {
        jest.resetModules();
        mockGetItem.mockReset();
        mockFetch.mockReset();
        (global as any).fetch = mockFetch;
        Platform.OS = 'android';
        setSnapshot = jest.fn<any>().mockResolvedValue(true);
        finishRefresh = jest.fn<any>().mockResolvedValue(true);
        hasWidgets = jest.fn<any>().mockResolvedValue(true);
        (NativeModules as any).HabitsWidget = {
            setSnapshot, finishRefresh, hasWidgets, clear: jest.fn<any>().mockResolvedValue(true),
        };
        stubSession(SESSION);
        stubApi();
    });

    afterEach(() => {
        delete (global as any).fetch;
    });

    const published = () => JSON.parse(setSnapshot.mock.calls[0][0] as string);

    it('publishes both boards with today derived the way the dashboard derives it', async () => {
        const result = await loadModule().default({ reason: 'periodic' });

        expect(result).toEqual({ published: true, reason: 'periodic' });
        expect(setSnapshot).toHaveBeenCalledTimes(1);
        const snapshot = published();
        expect(snapshot.scope).toBe('connections');
        expect(snapshot.boards.connections.you).toEqual({ rank: 2, points: 420, dailyStreak: 12 });
        expect(snapshot.boards.connections.top.map((row: any) => row.userName)).toEqual(['maya', 'me']);
        expect(snapshot.boards.global.you.rank).toBe(48);
        // g-live done, g-solo not done, g-pending excluded from both sides.
        expect(snapshot.today).toEqual({ done: 1, total: 2 });
        expect(snapshot.labels.todayProgress).toBe('1/2 habits');
        expect(snapshot.labels.refreshHint).toContain('{ago}');
        expect(finishRefresh).not.toHaveBeenCalled();
    });

    it('sends the stored session on every request, and the device zone on the today read', async () => {
        await loadModule().default();

        const urls = calledUrls();
        expect(urls.every((url) => url.startsWith('https://api.example.com/v1/users-service/'))).toBe(true);
        expect(urls.find((url) => url.includes('checkins/today'))).toContain('timeZone=America%2FChicago');
        expect(urls.find((url) => url.includes('scope=connections'))).toContain('limit=3');
        expect(urls.find((url) => url.includes('scope=global'))).toContain('limit=3');
        mockFetch.mock.calls.forEach(([, init]: any) => {
            expect(init.headers.authorization).toBe('Bearer token-abc');
            expect(init.headers['x-userid']).toBe('me');
            expect(init.headers['x-brand-variation']).toBe('habits');
            expect(init.headers['x-localecode']).toBe('en-us');
        });
    });

    it('defaults to the global board for a user with nobody on theirs', async () => {
        stubApi({ 'leaderboards?scope=connections': jsonResponse(lonelyBoard) });

        await loadModule().default();

        expect(published().scope).toBe('global');
        expect(published().hasFriends).toBe(false);
        expect(published().boards.global.you.rank).toBe(48);
    });

    it('publishes nothing when the global board fails, rather than a toggle with one side empty', async () => {
        stubApi({ 'leaderboards?scope=global': jsonResponse({ message: 'nope' }, 500) });

        const result = await loadModule().default();

        expect(result.skipped).toBe('request-failed');
        expect(setSnapshot).not.toHaveBeenCalled();
        expect(finishRefresh).toHaveBeenCalledTimes(1);
    });

    it('writes even when nothing but the timestamp changed, so "updated N ago" is true', async () => {
        const refresh = loadModule().default;
        await refresh();
        await refresh();

        expect(setSnapshot).toHaveBeenCalledTimes(2);
    });

    it('publishes nothing and ends the refresh when signed out', async () => {
        stubSession(null);

        const result = await loadModule().default({ reason: 'tap' });

        expect(result).toEqual({ published: false, reason: 'tap', skipped: 'no-session' });
        expect(mockFetch).not.toHaveBeenCalled();
        expect(setSnapshot).not.toHaveBeenCalled();
        expect(finishRefresh).toHaveBeenCalledTimes(1);
    });

    it('keeps the last snapshot on an expired token rather than blanking the widget', async () => {
        stubApi({ 'habits/goals': jsonResponse({ message: 'expired' }, 401) });

        const result = await loadModule().default();

        expect(result.skipped).toBe('unauthorized');
        expect(setSnapshot).not.toHaveBeenCalled();
        expect(finishRefresh).toHaveBeenCalledTimes(1);
    });

    it('publishes nothing when any input the count depends on fails', async () => {
        // A leaderboard next to a goals list that did not load would render "Start a habit →"
        // at a user with three.
        stubApi({ 'habits/goals': new Error('offline') });

        const result = await loadModule().default();

        expect(result.skipped).toBe('request-failed');
        expect(setSnapshot).not.toHaveBeenCalled();
        expect(finishRefresh).toHaveBeenCalledTimes(1);
    });

    it('tolerates losing the tracking registry, like the dashboard does', async () => {
        stubApi({ 'user-habits': jsonResponse({ message: 'nope' }, 500) });

        const result = await loadModule().default();

        expect(result.published).toBe(true);
        expect(published().today).toEqual({ done: 1, total: 2 });
    });

    it('hides archived habits from today when the registry loads', async () => {
        stubApi({
            'user-habits': jsonResponse({ userHabits: [{ id: 'uh', habitGoalId: 'g-solo', status: 'archived' }] }),
        });

        await loadModule().default();

        expect(published().today).toEqual({ done: 1, total: 1 });
    });

    it('spends no network without a placed widget', async () => {
        hasWidgets.mockResolvedValue(false);

        const result = await loadModule().default({ reason: 'push' });

        expect(result.skipped).toBe('no-widgets');
        expect(mockFetch).not.toHaveBeenCalled();
        expect(finishRefresh).toHaveBeenCalledTimes(1);
    });

    it('does nothing at all off Android', async () => {
        Platform.OS = 'ios';

        const result = await loadModule().default();

        expect(result.skipped).toBe('unsupported');
        expect(mockGetItem).not.toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
    });
});

describe('shouldRefreshWidgetForPush', () => {
    it('refreshes for pushes that move the board or today, and not for the rest', () => {
        const { shouldRefreshWidgetForPush } = loadModule();

        expect(shouldRefreshWidgetForPush('partner-checked-in')).toBe(true);
        expect(shouldRefreshWidgetForPush('leaderboard-rank-milestone')).toBe(true);
        expect(shouldRefreshWidgetForPush('streak-broken')).toBe(true);
        expect(shouldRefreshWidgetForPush('pact-invitation')).toBe(false);
        expect(shouldRefreshWidgetForPush('new-direct-message')).toBe(false);
        expect(shouldRefreshWidgetForPush(undefined)).toBe(false);
    });
});
