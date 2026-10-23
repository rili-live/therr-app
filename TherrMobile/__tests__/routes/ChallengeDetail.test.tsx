import 'react-native';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

/**
 * The challenge screen: which actions a viewer gets, that joining at the free-tier cap goes to
 * the paywall instead of a toast, and that a freshly created challenge opens the share sheet
 * once — the link is the whole point of creating one.
 */

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn() },
}));

jest.mock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

const mockGetByToken = jest.fn<(...args: any[]) => Promise<any>>();
const mockJoin = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('therr-react/services', () => ({
    HabitsChallengesService: {
        getByToken: (...args: any[]) => mockGetByToken(...args),
        join: (...args: any[]) => mockJoin(...args),
        leave: jest.fn(() => Promise.resolve({})),
        cancel: jest.fn(() => Promise.resolve({})),
    },
}));

// Reads the theme from redux; this screen's leave/end confirmation is not under test here.
jest.mock('../../main/components/Modals/ConfirmModal', () => ({
    __esModule: true,
    default: () => null,
}));

jest.mock('../../main/utilities/habitCapPaywall', () => ({
    getHabitCapPaywallParams: (err: any) => (err?.response?.status === 402 ? { reason: 'habit-limit-reached', limit: 3 } : null),
}));

// The screen reaches react-native's Share through the local resolver proxy, so the spy goes on
// the module the app actually imports.
import { Share } from 'react-native';
import { ChallengeDetail } from '../../main/routes/Challenges/ChallengeDetail';

const challenge = (overrides: any = {}) => ({
    id: 'c1',
    joinToken: 'AbCdEf123456',
    title: 'October miles',
    habitGoalId: 'g1',
    goal: { name: 'Run', emoji: null, amountUnit: null },
    creator: { userName: 'casey', displayName: 'Casey' },
    startDate: '2026-10-01',
    endDate: '2026-10-30',
    status: 'active',
    hasStarted: true,
    hasEnded: false,
    daysLeft: 8,
    durationDays: 30,
    memberCount: 2,
    maxMembers: 50,
    isFull: false,
    rankedBy: 'checkinDays',
    standings: [
        { rank: 1, userName: 'casey', displayName: 'Casey', checkinDays: 4, totalAmount: 0 },
        { rank: 2, userName: 'me_user', displayName: 'Me', checkinDays: 2, totalAmount: 0 },
    ],
    viewer: { isMember: false, isCreator: false, rank: null },
    ...overrides,
});

const flushPromises = () => new Promise<void>((resolve) => { setImmediate(resolve); });

const findPressableByLabel = (root: renderer.ReactTestInstance, label: string) => root
    .findAll((node) => node.props?.accessibilityLabel === label && typeof node.props?.onPress === 'function')[0];

const hasLabel = (root: renderer.ReactTestInstance, label: string) => root
    .findAll((node) => node.props?.accessibilityLabel === label).length > 0;

const renderScreen = async (params: any = { joinToken: 'AbCdEf123456' }) => {
    const navigation: any = { navigate: jest.fn(), setOptions: jest.fn(), goBack: jest.fn() };
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <ChallengeDetail
                user={{ settings: { locale: 'en-us' }, details: { id: 'me', userName: 'me_user' } } as any}
                navigation={navigation}
                route={{ params }}
            />,
        );
        await flushPromises();
    });
    // @ts-ignore - assigned inside act
    return { component: component as renderer.ReactTestRenderer, navigation };
};

describe('ChallengeDetail', () => {
    beforeEach(() => {
        mockGetByToken.mockReset();
        mockJoin.mockReset();
        jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    });

    it('offers an outsider Join, and no leave or end', async () => {
        mockGetByToken.mockResolvedValue({ data: challenge() });
        const { component } = await renderScreen();

        expect(hasLabel(component.root, 'Join this challenge')).toBe(true);
        expect(hasLabel(component.root, 'Leave challenge')).toBe(false);
        expect(hasLabel(component.root, 'End challenge')).toBe(false);
    });

    it('sends a join refused at the habit cap to the paywall', async () => {
        mockGetByToken.mockResolvedValue({ data: challenge() });
        mockJoin.mockRejectedValue({ response: { status: 402, data: { error: 'habit-limit-reached', limit: 3 } } });
        const { component, navigation } = await renderScreen();

        await act(async () => {
            findPressableByLabel(component.root, 'Join this challenge').props.onPress();
            await flushPromises();
        });

        expect(mockJoin).toHaveBeenCalledWith('AbCdEf123456', expect.anything());
        expect(navigation.navigate).toHaveBeenCalledWith('UpgradePaywall', expect.objectContaining({ reason: 'habit-limit-reached' }));
    });

    it('gives a member the habit, and the creator End rather than Leave', async () => {
        mockGetByToken.mockResolvedValue({ data: challenge({ viewer: { isMember: true, isCreator: true, rank: 1 } }) });
        const { component, navigation } = await renderScreen();

        expect(hasLabel(component.root, 'Join this challenge')).toBe(false);
        expect(hasLabel(component.root, 'End challenge')).toBe(true);
        expect(hasLabel(component.root, 'Leave challenge')).toBe(false);

        await act(async () => {
            findPressableByLabel(component.root, 'Check in on this habit').props.onPress();
        });
        expect(navigation.navigate).toHaveBeenCalledWith('HabitDetail', { habitGoalId: 'g1' });
    });

    it('opens the share sheet once for a challenge just created', async () => {
        mockGetByToken.mockResolvedValue({ data: challenge({ viewer: { isMember: true, isCreator: true, rank: 1 } }) });
        await renderScreen({ joinToken: 'AbCdEf123456', justCreated: true });

        expect(Share.share).toHaveBeenCalledTimes(1);
        expect((Share.share as any).mock.calls[0][0].url).toBe('https://habits.therr.com/c/AbCdEf123456');
    });

    it('shows a retryable error rather than an empty board when the read falls back offline', async () => {
        mockGetByToken.mockResolvedValue({ data: {}, isOfflineFallback: true });
        const { component } = await renderScreen();

        expect(hasLabel(component.root, 'Try again')).toBe(true);
        expect(hasLabel(component.root, 'Join this challenge')).toBe(false);
    });
});
