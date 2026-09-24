import 'react-native';
import { Text } from 'react-native';
// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';
import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

/**
 * The weekly leaderboard row on the habits dashboard's progress card.
 *
 * The leaderboard is only reachable from Achievements otherwise, and the habits dashboard is the
 * screen users open every day. These lock in that the row loads the user's own weekly rank, keeps
 * the last one when a refresh comes back empty offline, invites rather than reporting a rank the
 * user has not earned, and opens the board when tapped.
 */

const mockGetLeaderboard = jest.fn() as any;

jest.mock('therr-react/services', () => ({
    UsersService: {
        getLeaderboard: (...args: any[]) => mockGetLeaderboard(...args),
    },
}));

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn(), hide: jest.fn() },
}));

jest.mock('../../main/utilities/permissionsOrchestrator', () => ({
    __esModule: true,
    default: { requestIfAppropriate: jest.fn() },
}));

// Pulled in transitively via constants; resolves its native module at import time.
jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: {},
    AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2 },
    AndroidChannel: {},
}));

jest.mock('react-native-image-crop-picker', () => ({
    __esModule: true,
    default: { openPicker: jest.fn(), openCamera: jest.fn() },
}));

jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn(), wrap: jest.fn() },
}));

jest.mock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-permissions', () => ({
    __esModule: true,
    requestMultiple: jest.fn(() => Promise.resolve({})),
    checkMultiple: jest.fn(() => Promise.resolve({})),
    check: jest.fn(() => Promise.resolve('granted')),
    request: jest.fn(() => Promise.resolve('granted')),
    PERMISSIONS: { IOS: {}, ANDROID: {} },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
}));

// Imported after the mocks above deliberately — the screen pulls in a chain of
// native modules at import time.
import Toast from 'react-native-toast-message';
import { HabitsDashboard } from '../../main/routes/Habits/Dashboard';
import celebrationQueue from '../../main/utilities/celebrationQueue';
import * as habitsWidget from '../../main/utilities/habitsWidget';

const flushPromises = () => new Promise<void>((resolve) => { setImmediate(resolve); });

const buildInstance = () => {
    const props: any = {
        user: { settings: { locale: 'en-us' }, details: { id: 'me' } },
        habits: {
            habitGoals: [], todayCheckins: [], streaks: [], pacts: [], activePacts: [], pendingInvites: [],
        },
        navigation: { navigate: jest.fn(), addListener: jest.fn(), setOptions: jest.fn() },
        route: { params: {} },
        createCheckin: jest.fn(() => Promise.resolve({ id: 'checkin-1' })),
        getActiveStreaks: jest.fn(() => Promise.resolve([])),
    };

    const instance = new HabitsDashboard(props);
    instance.setState = jest.fn((partial: any) => {
        instance.state = { ...instance.state, ...partial };
    }) as any;

    return instance;
};

const renderRow = (instance: HabitsDashboard) => {
    let component: renderer.ReactTestRenderer;
    act(() => {
        component = renderer.create(instance.renderLeaderboardRow() as any);
    });
    // The icons render through `Text` too; the row's own lines are the single-line ones.
    const texts = component!.root.findAllByType(Text)
        .filter((node) => node.props.numberOfLines === 1)
        .map((node) => node.props.children);
    const button = component!.root.findAll(
        (node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
    )[0];
    return { texts, button };
};

describe('habits dashboard leaderboard row', () => {
    beforeEach(() => {
        mockGetLeaderboard.mockReset();
        (Toast.show as any).mockClear();
        celebrationQueue.reset();
    });

    it('loads only the requester\'s weekly rank', async () => {
        mockGetLeaderboard.mockResolvedValue({
            data: { entries: [], currentUser: { userId: 'me', rank: 7, points: 120 } },
        });
        const instance = buildInstance();

        instance.fetchWeeklyRank();
        await flushPromises();

        expect(mockGetLeaderboard).toHaveBeenCalledWith({ period: 'week', scope: 'global', limit: 1 });
        expect(instance.state.weeklyRank).toEqual({ rank: 7, points: 120 });
    });

    it('keeps the last rank when an offline refresh resolves empty', async () => {
        mockGetLeaderboard.mockResolvedValue({ data: {}, isOfflineFallback: true });
        const instance = buildInstance();
        instance.state = { ...instance.state, weeklyRank: { rank: 3, points: 90 } };

        instance.fetchWeeklyRank();
        await flushPromises();

        expect(instance.state.weeklyRank).toEqual({ rank: 3, points: 90 });
    });

    it('swallows a failed lookup rather than surfacing it on the dashboard', async () => {
        mockGetLeaderboard.mockRejectedValue(new Error('500'));
        const instance = buildInstance();

        instance.fetchWeeklyRank();
        await flushPromises();

        expect(instance.state.weeklyRank).toBeNull();
    });

    it('shows the rank and XP once the user has earned some this week', () => {
        const instance = buildInstance();
        instance.state = { ...instance.state, weeklyRank: { rank: 12, points: 340 } };

        const { texts } = renderRow(instance);

        expect(texts).toEqual(['#12 this week', '340 XP · See the leaderboard']);
    });

    it('invites instead of reporting a last place nobody has earned at 0 XP', () => {
        const instance = buildInstance();
        instance.state = { ...instance.state, weeklyRank: { rank: 48, points: 0 } };

        const { texts } = renderRow(instance);

        expect(texts).toEqual(['This week\'s leaderboard', 'Check in to earn XP and claim your spot']);
    });

    it('opens the leaderboard when tapped', () => {
        const instance = buildInstance();

        const { button } = renderRow(instance);
        button.props.onPress();

        expect(instance.props.navigation.navigate).toHaveBeenCalledWith('Leaderboard');
    });
});

/**
 * The "you climbed to #N" toast after a check-in. The check-in toast is the only route to the
 * note/photo screen, so the rank-up must wait for it, and must stand down entirely when a streak
 * celebration or the note screen has the user's attention — the new rank is on the card anyway.
 */
describe('habits dashboard rank-up toast', () => {
    const shownTitles = () => (Toast.show as any).mock.calls.map((call: any[]) => call[0].text1);
    const RANK_UP = '🏆 You climbed to #9 this week';

    beforeEach(() => {
        mockGetLeaderboard.mockReset();
        (Toast.show as any).mockClear();
        celebrationQueue.reset();
    });

    const withRank = (rank: number, points: number) => {
        mockGetLeaderboard.mockResolvedValue({
            data: { entries: [], currentUser: { userId: 'me', rank, points } },
        });
    };

    it('announces the new rank once the check-in toast has gone', async () => {
        withRank(9, 150);
        const instance = buildInstance();
        instance.state = { ...instance.state, weeklyRank: { rank: 14, points: 100 } };

        instance.submitCheckin({ id: 'goal-1', name: 'Read' } as any);
        await flushPromises();

        // Only the check-in toast so far; the rank-up is waiting behind it.
        expect(shownTitles()).not.toContain(RANK_UP);
        expect(instance.state.weeklyRank).toEqual({ rank: 9, points: 150 });

        const checkinToast = (Toast.show as any).mock.calls[0][0];
        checkinToast.onHide();

        expect(shownTitles()).toContain(RANK_UP);
        const rankUpToast = (Toast.show as any).mock.calls.find((call: any[]) => call[0].text1 === RANK_UP)[0];
        rankUpToast.onPress();
        expect(instance.props.navigation.navigate).toHaveBeenCalledWith('Leaderboard');
    });

    it('stands down when the note screen or a celebration holds the queue', async () => {
        withRank(9, 150);
        const instance = buildInstance();
        instance.state = { ...instance.state, weeklyRank: { rank: 14, points: 100 } };

        instance.submitCheckin({ id: 'goal-1', name: 'Read' } as any);
        await flushPromises();

        // The user tapped through to the note screen, which holds the queue until it closes.
        celebrationQueue.block();
        (Toast.show as any).mock.calls[0][0].onHide();

        expect(shownTitles()).not.toContain(RANK_UP);
    });

    it('stays quiet when the rank did not improve', async () => {
        withRank(14, 150);
        const instance = buildInstance();
        instance.state = { ...instance.state, weeklyRank: { rank: 14, points: 100 } };

        instance.submitCheckin({ id: 'goal-1', name: 'Read' } as any);
        await flushPromises();
        (Toast.show as any).mock.calls[0][0].onHide();

        expect(shownTitles()).not.toContain(RANK_UP);
    });

    it('never announces the first rank it sees, with nothing to compare against', async () => {
        withRank(9, 150);
        const instance = buildInstance();

        instance.submitCheckin({ id: 'goal-1', name: 'Read' } as any);
        await flushPromises();
        (Toast.show as any).mock.calls[0][0].onHide();

        expect(shownTitles()).not.toContain(RANK_UP);
    });

    it('does not announce on an ordinary refresh', async () => {
        withRank(9, 150);
        const instance = buildInstance();
        instance.state = { ...instance.state, weeklyRank: { rank: 14, points: 100 } };

        instance.fetchWeeklyRank();
        await flushPromises();

        expect(Toast.show).not.toHaveBeenCalled();
    });
});

/**
 * The Android home-screen widget is fed from the same refresh. It shows the friends board —
 * the app is Friends with Habits — and only falls back to the global board when the user has
 * nobody on theirs, so the widget can offer an invite instead of a one-person ranking.
 */
describe('habits dashboard home-screen widget feed', () => {
    let publish: jest.SpiedFunction<typeof habitsWidget.publishHabitsWidget>;

    const board = (entries: any[], rank = 2) => ({
        data: { entries, currentUser: { userId: 'me', rank, points: 300, dailyStreak: 5 }, periodEnd: '2026-09-28' },
    });
    const me = { rank: 2, userName: 'me', points: 300, isRequestingUser: true };
    const friend = { rank: 1, userName: 'maya', points: 400, isRequestingUser: false };

    beforeEach(() => {
        mockGetLeaderboard.mockReset();
        jest.spyOn(habitsWidget, 'isHabitsWidgetSupported').mockReturnValue(true);
        publish = jest.spyOn(habitsWidget, 'publishHabitsWidget').mockImplementation(() => {});
        // spyOn hands back the same spy on a second call, calls and all.
        publish.mockClear();
    });

    it('publishes the friends board when the user has friends on it', async () => {
        mockGetLeaderboard.mockResolvedValue(board([friend, me]));
        const instance = buildInstance();

        instance.refreshHabitsWidget();
        await flushPromises();

        expect(mockGetLeaderboard).toHaveBeenCalledWith({ period: 'week', scope: 'connections', limit: 3 });
        expect(mockGetLeaderboard).not.toHaveBeenCalledWith({ period: 'week', scope: 'global', limit: 3 });
        expect(publish).toHaveBeenCalledWith(expect.objectContaining({ scope: 'connections', you: { rank: 2, points: 300, dailyStreak: 5 } }));
    });

    it('falls back to the global board for a user with no friends on theirs', async () => {
        mockGetLeaderboard.mockImplementation((args: any) => Promise.resolve(
            args.scope === 'connections' ? board([me], 1) : board([friend, me], 2),
        ));
        const instance = buildInstance();

        instance.refreshHabitsWidget();
        await flushPromises();

        expect(mockGetLeaderboard).toHaveBeenCalledWith({ period: 'week', scope: 'global', limit: 3 });
        expect(publish).toHaveBeenCalledWith(expect.objectContaining({ scope: 'global' }));
    });

    it('keeps the last snapshot when offline', async () => {
        mockGetLeaderboard.mockResolvedValue({ data: {}, isOfflineFallback: true });
        const instance = buildInstance();

        instance.refreshHabitsWidget();
        await flushPromises();

        expect(publish).not.toHaveBeenCalled();
    });

    it('makes no request where there is no widget to feed', async () => {
        (habitsWidget.isHabitsWidgetSupported as jest.Mock).mockReturnValue(false);
        const instance = buildInstance();

        instance.refreshHabitsWidget();
        await flushPromises();

        expect(mockGetLeaderboard).not.toHaveBeenCalled();
    });

    it('republishes when today\'s check-ins change', async () => {
        mockGetLeaderboard.mockResolvedValue(board([friend, me]));
        const instance = buildInstance();
        instance.refreshHabitsWidget();
        await flushPromises();
        publish.mockClear();

        const prevProps = instance.props;
        (instance as any).props = { ...prevProps, habits: { ...prevProps.habits, todayCheckins: [] } };
        instance.componentDidUpdate(prevProps);

        expect(publish).toHaveBeenCalledTimes(1);
    });

    it.each(['habitGoals', 'activePacts', 'pacts', 'userHabits'])(
        'republishes when %s changes, since it moves the habit count the widget divides by',
        async (key) => {
            mockGetLeaderboard.mockResolvedValue(board([friend, me]));
            const instance = buildInstance();
            instance.refreshHabitsWidget();
            await flushPromises();
            publish.mockClear();

            const prevProps = instance.props;
            (instance as any).props = { ...prevProps, habits: { ...prevProps.habits, [key]: [] } };
            instance.componentDidUpdate(prevProps);

            expect(publish).toHaveBeenCalledTimes(1);
        },
    );

    it('does not republish when nothing today\'s count reads has changed', async () => {
        mockGetLeaderboard.mockResolvedValue(board([friend, me]));
        const instance = buildInstance();
        instance.refreshHabitsWidget();
        await flushPromises();
        publish.mockClear();

        const prevProps = instance.props;
        (instance as any).props = { ...prevProps, habits: { ...prevProps.habits, pendingInvites: [] } };
        instance.componentDidUpdate(prevProps);

        expect(publish).not.toHaveBeenCalled();
    });
});
