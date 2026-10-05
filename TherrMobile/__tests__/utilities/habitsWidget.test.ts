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

const globalBoard = {
    entries: [
        { rank: 1, userName: 'alex', points: 990, dailyStreak: 50, isRequestingUser: false },
        { rank: 2, userName: 'maya', points: 610, dailyStreak: 30, isRequestingUser: false },
    ],
    currentUser: { rank: 48, points: 420, dailyStreak: 12 },
    periodEnd: '2026-09-28',
};

const lonelyBoard = {
    entries: [{ rank: 1, userName: 'me', points: 420, dailyStreak: 12, isRequestingUser: true }],
    currentUser: { rank: 1, points: 420, dailyStreak: 12 },
    periodEnd: '2026-09-28',
};

const boards = { connections: friendsBoard, global: globalBoard };

describe('buildHabitsWidgetSnapshot', () => {
    it('carries your standing and the top three of both boards, and today', () => {
        const { buildHabitsWidgetSnapshot } = loadModule();
        const snapshot = buildHabitsWidgetSnapshot(boards, { done: 2, total: 3 }, translate, 1000);

        expect(snapshot).toMatchObject({
            v: 2,
            scope: 'connections',
            hasFriends: true,
            periodEnd: '2026-09-28',
            updatedAt: 1000,
            today: { done: 2, total: 3 },
        });
        expect(snapshot.boards.connections.you).toEqual({ rank: 4, points: 420, dailyStreak: 12 });
        expect(snapshot.boards.global.you).toEqual({ rank: 48, points: 420, dailyStreak: 12 });
        // A user outside the top three is still shown in the stats row, not the list.
        expect(snapshot.boards.connections.top.map((row: any) => row.userName)).toEqual(['maya', 'jordan', 'sam']);
        expect(snapshot.boards.connections.top[2].dailyStreak).toBe(0);
        expect(snapshot.boards.global.top.map((row: any) => row.userName)).toEqual(['alex', 'maya']);
    });

    it('labels an account with no username rather than leaving a blank row', () => {
        const { buildHabitsWidgetSnapshot } = loadModule();
        const unnamedBoard = {
            ...globalBoard,
            entries: [
                { rank: 1, userName: null, points: 990, isRequestingUser: false },
                { rank: 2, userName: 'maya', points: 610, isRequestingUser: false },
            ],
        };
        const snapshot = buildHabitsWidgetSnapshot({ connections: friendsBoard, global: unnamedBoard }, { done: 0, total: 1 }, translate);

        expect(snapshot.boards.global.top.map((row: any) => row.userName)).toEqual(['pages.userProfile.anonymous', 'maya']);
    });

    it('labels each board and both halves of the toggle', () => {
        const { buildHabitsWidgetSnapshot } = loadModule();
        const snapshot = buildHabitsWidgetSnapshot(boards, { done: 0, total: 1 }, translate);

        expect(snapshot.boards.connections.labels.rankContext).toBe('pages.habits.widget.amongFriends');
        expect(snapshot.boards.global.labels.rankContext).toBe('pages.habits.widget.overall');
        expect(snapshot.labels.scopeFriends).toBe('pages.leaderboard.tabs.friends');
        expect(snapshot.labels.scopeEveryone).toBe('pages.leaderboard.tabs.everyone');
    });

    it('defaults to the global board, and flags the missing friends, for a user with none', () => {
        const { buildHabitsWidgetSnapshot } = loadModule();
        const snapshot = buildHabitsWidgetSnapshot({ connections: lonelyBoard, global: globalBoard }, { done: 0, total: 1 }, translate);

        expect(snapshot.scope).toBe('global');
        expect(snapshot.hasFriends).toBe(false);
        // The friends side still carries a board, so picking it on the toggle has something to show.
        expect(snapshot.boards.connections.top.map((row: any) => row.userName)).toEqual(['me']);
    });

    it('leaves {days} for the widget to fill, so the countdown moves without the app', () => {
        const { buildHabitsWidgetSnapshot } = loadModule();
        const translator = require('../../main/utilities/translator').default;
        const snapshot = buildHabitsWidgetSnapshot(
            boards,
            { done: 1, total: 2 },
            (key: string, params?: any) => translator('en-us', key, params),
        );

        expect(snapshot.labels.resetsIn).toContain('{days}');
        expect(snapshot.boards.connections.labels.points).toBe('420 XP');
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
        const none = buildHabitsWidgetSnapshot(boards, { done: 0, total: 0 }, translate);
        const over = buildHabitsWidgetSnapshot(boards, { done: 5, total: 2 }, translate);

        expect(none.labels.todayProgress).toBe('pages.habits.widget.startHabit');
        expect(over.today).toEqual({ done: 2, total: 2 });
    });
});

describe('streak widget block', () => {
    const withStreak = (dailyStreak?: number) => ({
        connections: { ...friendsBoard, currentUser: { rank: 4, points: 420, dailyStreak } },
        global: { ...globalBoard, currentUser: { rank: 48, points: 420, dailyStreak } },
    });

    it("carries the user's daily streak with the plural label beside it", () => {
        const { buildHabitsWidgetSnapshot } = loadModule();
        const snapshot = buildHabitsWidgetSnapshot(boards, { done: 0, total: 1 }, translate);

        expect(snapshot.streak).toMatchObject({ days: 12, label: 'pages.celebration.streak.dayStreak' });
    });

    it('says one day in the singular, which Spanish and French need', () => {
        const { buildHabitsWidgetSnapshot } = loadModule();

        expect(buildHabitsWidgetSnapshot(withStreak(1), { done: 1, total: 1 }, translate).streak)
            .toMatchObject({ days: 1, label: 'pages.habits.widget.streakDayOne' });
    });

    it('asks for a check-in instead of labelling a zero, missing or broken streak', () => {
        const { buildHabitsWidgetSnapshot } = loadModule();
        [0, undefined, NaN].forEach((dailyStreak) => {
            expect(buildHabitsWidgetSnapshot(withStreak(dailyStreak), { done: 0, total: 1 }, translate).streak)
                .toMatchObject({ days: 0, label: 'pages.habits.widget.streakStart' });
        });
    });

    it('still finds the streak when one board left the requester out', () => {
        const { buildHabitsWidgetSnapshot } = loadModule();
        const snapshot = buildHabitsWidgetSnapshot(
            { connections: { ...friendsBoard, currentUser: undefined }, global: globalBoard },
            { done: 0, total: 1 },
            translate,
        );

        expect(snapshot.streak.days).toBe(12);
    });

    it('stamps the local day a check-in already counts for, and nothing before one', () => {
        const { buildHabitsWidgetSnapshot } = loadModule();
        const evening = new Date(2026, 9, 1, 20, 15).getTime();

        expect(buildHabitsWidgetSnapshot(boards, { done: 1, total: 2 }, translate, evening).streak.checkedInOn).toBe('2026-10-01');
        expect(buildHabitsWidgetSnapshot(boards, { done: 0, total: 2 }, translate, evening).streak.checkedInOn).toBeNull();
    });

    it('carries the due weekdays it is given, and the warning label', () => {
        const { buildHabitsWidgetSnapshot } = loadModule();
        const snapshot = buildHabitsWidgetSnapshot(boards, { done: 0, total: 1, dueWeekdays: [1, 3] }, translate);
        const withoutDays = buildHabitsWidgetSnapshot(boards, { done: 0, total: 1 }, translate);

        expect(snapshot.streak.dueWeekdays).toEqual([1, 3]);
        expect(snapshot.streak.stake).toBeNull();
        expect(snapshot.streak.atRiskLabel).toBe('pages.habits.widget.streakAtRisk');
        // No cadence known means no warning, not a warning every evening.
        expect(withoutDays.streak.dueWeekdays).toEqual([]);
    });

    it('has every streak label in every locale', () => {
        const dictionaries = ['en-us', 'es', 'fr-ca'].map((locale) => require(`../../main/locales/${locale}/dictionary.json`));
        dictionaries.forEach((dictionary) => {
            expect(typeof dictionary.pages.habits.widget.streakDayOne).toBe('string');
            expect(typeof dictionary.pages.habits.widget.streakStart).toBe('string');
            expect(typeof dictionary.pages.habits.widget.streakAtRisk).toBe('string');
            expect(typeof dictionary.pages.celebration.streak.dayStreak).toBe('string');
        });
    });
});

describe('getStakeVerdict', () => {
    it('dates the server verdict with the day it was about', () => {
        const { getStakeVerdict } = loadModule();

        expect(getStakeVerdict({ today: '2026-10-01', isAtStakeToday: false })).toEqual({ date: '2026-10-01', isAtStake: false });
        expect(getStakeVerdict({ today: '2026-10-01', isAtStakeToday: true })).toEqual({ date: '2026-10-01', isAtStake: true });
    });

    it('is null without a usable verdict, so the widget falls back to cadence', () => {
        const { getStakeVerdict } = loadModule();

        [null, undefined, {}, { today: '2026-10-01' }, { isAtStakeToday: true }, { today: 'Oct 1', isAtStakeToday: true }]
            .forEach((summary) => expect(getStakeVerdict(summary as any)).toBeNull());
    });
});

describe('getDueWeekdays', () => {
    it('counts every day for a daily habit and its own days for a fixed-day one', () => {
        const { getDueWeekdays } = loadModule();

        expect(getDueWeekdays([{ frequencyType: 'daily' }])).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(getDueWeekdays([{ frequencyType: 'weekly', targetDaysOfWeek: [5, 1, 1] }])).toEqual([1, 5]);
        expect(getDueWeekdays([{ targetDaysOfWeek: [0] }, { frequencyType: 'weekly', targetDaysOfWeek: [6] }])).toEqual([0, 6]);
    });

    it('leaves a weekly-count habit out, since only its week can say whether today is needed', () => {
        const { getDueWeekdays } = loadModule();

        expect(getDueWeekdays([{ frequencyType: 'weekly', frequencyCount: 4 }])).toEqual([]);
        expect(getDueWeekdays([{ frequencyType: 'weekly', frequencyCount: 4 }, { targetDaysOfWeek: [2] }])).toEqual([2]);
        expect(getDueWeekdays([null, undefined])).toEqual([]);
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
        .buildHabitsWidgetSnapshot(boards, { done: 1, total: 2 }, translate, Date.now());

    it('writes the snapshot as JSON', () => {
        const { publishHabitsWidget } = loadModule();
        publishHabitsWidget(snapshot());

        expect(setSnapshot).toHaveBeenCalledTimes(1);
        expect(JSON.parse(setSnapshot.mock.calls[0][0] as string).boards.connections.you.rank).toBe(4);
    });

    it('skips a write that would change nothing but the timestamp', () => {
        const { publishHabitsWidget, buildHabitsWidgetSnapshot } = loadModule();
        publishHabitsWidget(buildHabitsWidgetSnapshot(boards, { done: 1, total: 2 }, translate, 1));
        publishHabitsWidget(buildHabitsWidgetSnapshot(boards, { done: 1, total: 2 }, translate, 2));
        publishHabitsWidget(buildHabitsWidgetSnapshot(boards, { done: 2, total: 2 }, translate, 3));

        expect(setSnapshot).toHaveBeenCalledTimes(2);
    });

    it('writes an unchanged snapshot when forced, and reports whether it wrote', () => {
        const { publishHabitsWidget, buildHabitsWidgetSnapshot } = loadModule();
        const first = publishHabitsWidget(buildHabitsWidgetSnapshot(boards, { done: 1, total: 2 }, translate, 1));
        const skipped = publishHabitsWidget(buildHabitsWidgetSnapshot(boards, { done: 1, total: 2 }, translate, 2));
        const forced = publishHabitsWidget(
            buildHabitsWidgetSnapshot(boards, { done: 1, total: 2 }, translate, 3),
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
