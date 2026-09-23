import 'react-native';
import React from 'react';
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
import { HabitsDashboard } from '../../main/routes/Habits/Dashboard';

const flushPromises = () => new Promise<void>((resolve) => { setImmediate(resolve); });

const buildInstance = () => {
    const props: any = {
        user: { settings: { locale: 'en-us' }, details: { id: 'me' } },
        habits: {
            habitGoals: [], todayCheckins: [], streaks: [], pacts: [], activePacts: [], pendingInvites: [],
        },
        navigation: { navigate: jest.fn(), addListener: jest.fn(), setOptions: jest.fn() },
        route: { params: {} },
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
