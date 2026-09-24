import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';
import { NativeModules, Platform } from 'react-native';

/**
 * The home-screen widget's JS half: what goes into the snapshot, when it is (not) written,
 * and where each widget tap lands.
 *
 * The widget renders only what this snapshot carries — it has no network access and no
 * token — so a wrong or missing field here is a wrong widget, with nothing downstream to
 * correct it.
 */

// Mutable so a test can stand in for a non-habits build.
let mockBrand = 'habits';
jest.mock('../../main/config/brandConfig', () => ({
    __esModule: true,
    get CURRENT_BRAND_VARIATION() { return mockBrand; },
    BRAND_DISPLAY_NAME: 'Friends with Habits',
}));

const loadModule = () => require('../../main/utilities/habitsWidget');

const translate = (key: string, params?: any) => (params ? `${key}:${JSON.stringify(params)}` : key);

const friendsBoard = {
    entries: [
        { rank: 1, userName: 'maya', points: 610, dailyStreak: 30, isRequestingUser: false },
        { rank: 2, userName: 'jordan', points: 505, dailyStreak: 4, isRequestingUser: false },
        { rank: 3, userName: 'sam', points: 470, isRequestingUser: false },
        { rank: 4, userName: 'me', points: 420, dailyStreak: 12, isRequestingUser: true },
    ],
    currentUser: { rank: 4, points: 420, dailyStreak: 12 },
    periodEnd: '2026-09-28',
};

describe('buildHabitsWidgetSnapshot', () => {
    it('carries your standing, today and the top three', () => {
        const { buildHabitsWidgetSnapshot } = loadModule();
        const snapshot = buildHabitsWidgetSnapshot(friendsBoard, 'connections', { done: 2, total: 3 }, translate, 1000);

        expect(snapshot).toMatchObject({
            v: 1,
            scope: 'connections',
            periodEnd: '2026-09-28',
            updatedAt: 1000,
            you: { rank: 4, points: 420, dailyStreak: 12 },
            today: { done: 2, total: 3 },
        });
        // A user outside the top three is still shown in the stats row, not the list.
        expect(snapshot.top.map((row: any) => row.userName)).toEqual(['maya', 'jordan', 'sam']);
        expect(snapshot.top[2].dailyStreak).toBe(0);
    });

    it('labels the board it is showing', () => {
        const { buildHabitsWidgetSnapshot } = loadModule();
        const friends = buildHabitsWidgetSnapshot(friendsBoard, 'connections', { done: 0, total: 1 }, translate);
        const global = buildHabitsWidgetSnapshot(friendsBoard, 'global', { done: 0, total: 1 }, translate);

        expect(friends.labels.title).toBe('pages.habits.widget.friendsThisWeek');
        expect(friends.labels.rankContext).toBe('pages.habits.widget.amongFriends');
        expect(global.labels.title).toBe('pages.habits.widget.everyoneThisWeek');
        expect(global.labels.rankContext).toBe('pages.habits.widget.overall');
    });

    it('leaves {days} for the widget to fill, so the countdown moves without the app', () => {
        const { buildHabitsWidgetSnapshot } = loadModule();
        const translator = require('../../main/utilities/translator').default;
        const snapshot = buildHabitsWidgetSnapshot(
            friendsBoard,
            'connections',
            { done: 1, total: 2 },
            (key: string, params?: any) => translator('en-us', key, params),
        );

        expect(snapshot.labels.resetsIn).toContain('{days}');
        expect(snapshot.labels.points).toBe('420 XP');
        expect(snapshot.labels.todayProgress).toBe('1/2 habits');
        // The freshness label is the same deal: the widget fills it on every redraw.
        expect(snapshot.labels.minutesAgo).toContain('{minutes}');
        expect(snapshot.labels.hoursAgo).toContain('{hours}');
        expect(snapshot.labels.daysAgo).toContain('{days}');
        expect(snapshot.labels.refreshHint).toContain('{ago}');
        expect(snapshot.labels.justNow).toBe('just now');
        expect(snapshot.labels.refreshing).toBe('Refreshing…');
    });

    it('invites a habit instead of showing 0/0, and clamps today to the total', () => {
        const { buildHabitsWidgetSnapshot } = loadModule();
        const none = buildHabitsWidgetSnapshot(friendsBoard, 'connections', { done: 0, total: 0 }, translate);
        const over = buildHabitsWidgetSnapshot(friendsBoard, 'connections', { done: 5, total: 2 }, translate);

        expect(none.labels.todayProgress).toBe('pages.habits.widget.startHabit');
        expect(over.today).toEqual({ done: 2, total: 2 });
    });
});

describe('hasFriendsOnBoard', () => {
    it('is false when the requester is the only one on it', () => {
        const { hasFriendsOnBoard } = loadModule();

        expect(hasFriendsOnBoard(friendsBoard)).toBe(true);
        expect(hasFriendsOnBoard({ entries: [{ rank: 1, userName: 'me', points: 0, isRequestingUser: true }] })).toBe(false);
        expect(hasFriendsOnBoard({ entries: [] })).toBe(false);
        expect(hasFriendsOnBoard(undefined)).toBe(false);
    });
});

describe('publishHabitsWidget / clearHabitsWidget', () => {
    let setSnapshot: jest.Mock<any>;
    let clear: jest.Mock<any>;
    let finishRefresh: jest.Mock<any>;
    let hasWidgets: jest.Mock<any>;

    beforeEach(() => {
        jest.resetModules();
        mockBrand = 'habits';
        Platform.OS = 'android';
        setSnapshot = jest.fn<any>().mockResolvedValue(true);
        clear = jest.fn<any>().mockResolvedValue(true);
        finishRefresh = jest.fn<any>().mockResolvedValue(true);
        hasWidgets = jest.fn<any>().mockResolvedValue(true);
        (NativeModules as any).HabitsWidget = {
            setSnapshot, clear, finishRefresh, hasWidgets,
        };
    });

    const snapshot = () => loadModule()
        .buildHabitsWidgetSnapshot(friendsBoard, 'connections', { done: 1, total: 2 }, translate, Date.now());

    it('writes the snapshot as JSON', () => {
        const { publishHabitsWidget } = loadModule();
        publishHabitsWidget(snapshot());

        expect(setSnapshot).toHaveBeenCalledTimes(1);
        expect(JSON.parse(setSnapshot.mock.calls[0][0] as string).you.rank).toBe(4);
    });

    it('skips a write that would change nothing but the timestamp', () => {
        const { publishHabitsWidget, buildHabitsWidgetSnapshot } = loadModule();
        publishHabitsWidget(buildHabitsWidgetSnapshot(friendsBoard, 'connections', { done: 1, total: 2 }, translate, 1));
        publishHabitsWidget(buildHabitsWidgetSnapshot(friendsBoard, 'connections', { done: 1, total: 2 }, translate, 2));
        publishHabitsWidget(buildHabitsWidgetSnapshot(friendsBoard, 'connections', { done: 2, total: 2 }, translate, 3));

        expect(setSnapshot).toHaveBeenCalledTimes(2);
    });

    it('writes an unchanged snapshot when forced, and reports whether it wrote', () => {
        const { publishHabitsWidget, buildHabitsWidgetSnapshot } = loadModule();
        const first = publishHabitsWidget(buildHabitsWidgetSnapshot(friendsBoard, 'connections', { done: 1, total: 2 }, translate, 1));
        const skipped = publishHabitsWidget(buildHabitsWidgetSnapshot(friendsBoard, 'connections', { done: 1, total: 2 }, translate, 2));
        const forced = publishHabitsWidget(
            buildHabitsWidgetSnapshot(friendsBoard, 'connections', { done: 1, total: 2 }, translate, 3),
            { force: true },
        );

        expect([first, skipped, forced]).toEqual([true, false, true]);
        expect(setSnapshot).toHaveBeenCalledTimes(2);
        expect(JSON.parse(setSnapshot.mock.calls[1][0] as string).updatedAt).toBe(3);
    });

    it('writes again after a logout clears the widget', () => {
        const { publishHabitsWidget, clearHabitsWidget } = loadModule();
        const same = snapshot();
        publishHabitsWidget(same);
        clearHabitsWidget();
        publishHabitsWidget(same);

        expect(clear).toHaveBeenCalledTimes(1);
        expect(setSnapshot).toHaveBeenCalledTimes(2);
    });

    it('does nothing on iOS', async () => {
        Platform.OS = 'ios';
        const {
            publishHabitsWidget, clearHabitsWidget, finishHabitsWidgetRefresh, hasHabitsWidgets, isHabitsWidgetSupported,
        } = loadModule();
        publishHabitsWidget(snapshot());
        clearHabitsWidget();
        finishHabitsWidgetRefresh();

        expect(isHabitsWidgetSupported()).toBe(false);
        expect(await hasHabitsWidgets()).toBe(false);
        expect(setSnapshot).not.toHaveBeenCalled();
        expect(clear).not.toHaveBeenCalled();
        expect(finishRefresh).not.toHaveBeenCalled();
        expect(hasWidgets).not.toHaveBeenCalled();
    });

    it('asks the native side whether a widget is placed, and answers no when it cannot', async () => {
        const { hasHabitsWidgets } = loadModule();

        expect(await hasHabitsWidgets()).toBe(true);
        hasWidgets.mockRejectedValue(new Error('boom'));
        expect(await hasHabitsWidgets()).toBe(false);
    });

    it('does nothing on another brand', () => {
        mockBrand = 'therr';
        const { publishHabitsWidget, isHabitsWidgetSupported } = loadModule();
        publishHabitsWidget(snapshot());

        expect(isHabitsWidgetSupported()).toBe(false);
        expect(setSnapshot).not.toHaveBeenCalled();
    });

    it('does nothing, and does not throw, without the native module', () => {
        delete (NativeModules as any).HabitsWidget;
        const { publishHabitsWidget, clearHabitsWidget, finishHabitsWidgetRefresh } = loadModule();

        expect(() => {
            publishHabitsWidget(snapshot());
            clearHabitsWidget();
            finishHabitsWidgetRefresh();
        }).not.toThrow();
    });
});

describe('getWidgetActionRoute', () => {
    it('maps each widget tap to its screen, for any package prefix', () => {
        const { getWidgetActionRoute } = loadModule();

        expect(getWidgetActionRoute('com.therr.habits.WIDGET_OPEN_LEADERBOARD'))
            .toEqual({ view: 'Leaderboard', params: { initialScope: 'connections' } });
        expect(getWidgetActionRoute('com.therr.habits.WIDGET_OPEN_LEADERBOARD_GLOBAL'))
            .toEqual({ view: 'Leaderboard', params: { initialScope: 'global' } });
        expect(getWidgetActionRoute('app.therrmobile.WIDGET_OPEN_TODAY'))
            .toEqual({ view: 'HabitsDashboard', params: { initialTab: 'habits' } });
        expect(getWidgetActionRoute('com.therr.habits.WIDGET_INVITE_FRIENDS'))
            .toEqual({ view: 'Invite', params: {} });
    });

    it('ignores anything that is not a widget action', () => {
        const { getWidgetActionRoute } = loadModule();

        // "Open app" is a plain launch — it has nowhere to route to.
        expect(getWidgetActionRoute('com.therr.habits.WIDGET_OPEN_APP')).toBeNull();
        expect(getWidgetActionRoute('app.therrmobile.QUICK_CREATE_MOMENT')).toBeNull();
        expect(getWidgetActionRoute(null)).toBeNull();
    });
});
