import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import {
    it, describe, expect, jest, beforeEach, afterEach,
} from '@jest/globals';

/**
 * The reward chest stage of the streak celebration: Continue leads to the chest rather than out,
 * the open request goes out on the FIRST knock (so the next two hide its latency), the reward is
 * only revealed once the third knock and the response have both landed, and a failed open hands
 * the chest back for another try instead of trapping the user.
 */
jest.mock('lottie-react-native', () => 'LottieView');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MaterialCommunityIcon');
jest.mock('../../main/utilities/rewardFeedback', () => ({
    __esModule: true,
    triggerRewardCelebration: () => () => undefined,
    triggerChestTapFeedback: jest.fn(),
    triggerChestOpenFeedback: jest.fn(() => () => undefined),
}));
jest.mock('../../main/utilities/analyticsEvents', () => ({
    __esModule: true,
    logAppEvent: jest.fn(),
}));
jest.mock('../../main/utilities/celebrationQueue', () => ({
    __esModule: true,
    default: { onDismissed: jest.fn() },
}));

import { Celebration } from '../../main/routes/Celebration';
import { logAppEvent } from '../../main/utilities/analyticsEvents';

const baseParams = {
    type: 'streak',
    streak: 4,
    week: [],
    milestone: false,
    perfectWeek: false,
    newLongest: false,
    date: '2026-10-11',
};

const buildNavigation = () => ({
    goBack: jest.fn(),
    navigate: jest.fn(),
    reset: jest.fn(),
    canGoBack: jest.fn(() => true),
    isFocused: jest.fn(() => true),
});

let mounted: renderer.ReactTestRenderer | undefined;

const renderScreen = (params: any, props: Record<string, any> = {}) => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(
            <Celebration
                navigation={props.navigation || buildNavigation()}
                route={{ params }}
                user={{ settings: { locale: 'en-us', mobileThemeName: 'light' }, details: {} } as any}
                lifetimeOffer={null}
                markDailyStreakCelebrated={props.markDailyStreakCelebrated || jest.fn(() => Promise.resolve())}
                acknowledgePlacement={jest.fn(() => Promise.resolve())}
                openDailyRewardChest={props.openDailyRewardChest || jest.fn(() => Promise.resolve())}
            />,
        );
    });
    mounted = tree!;
    return tree!;
};

const findButtons = (tree: renderer.ReactTestRenderer) => tree.root.findAll((node) => typeof node.type !== 'string'
    && node.props.accessibilityRole === 'button'
    && typeof node.props.onPress === 'function');

const findChest = (tree: renderer.ReactTestRenderer) => tree.root.find((node) => typeof node.type !== 'string'
    && node.props.accessibilityRole === 'button'
    && typeof node.props.accessibilityLabel === 'string'
    && node.props.accessibilityLabel.startsWith('Reward chest'));

const pressContinue = (tree: renderer.ReactTestRenderer) => {
    const buttons = findButtons(tree);
    act(() => {
        buttons[buttons.length - 1].props.onPress();
    });
};

const knock = (tree: renderer.ReactTestRenderer) => {
    act(() => {
        findChest(tree).props.onPress();
    });
};

const flushPromises = async () => {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
};

const textContent = (tree: renderer.ReactTestRenderer) => tree.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''))
    .join(' | ');

describe('Celebration — reward chest', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        (logAppEvent as any).mockClear();
    });

    afterEach(() => {
        act(() => {
            mounted?.unmount();
        });
        mounted = undefined;
        jest.useRealTimers();
    });

    it('leads Continue to the chest instead of out, and hides Continue until it is opened', () => {
        const markDailyStreakCelebrated = jest.fn(() => Promise.resolve());
        const tree = renderScreen(
            { ...baseParams, rewardChest: { tier: 'standard', isOpened: false } },
            { markDailyStreakCelebrated },
        );

        pressContinue(tree);

        expect(markDailyStreakCelebrated).not.toHaveBeenCalled();
        expect(findChest(tree)).toBeTruthy();
        // The chest itself is the only button on the stage until it is open.
        expect(findButtons(tree)).toHaveLength(1);
    });

    it('requests on the first knock and reveals after the third', async () => {
        const openDailyRewardChest = jest.fn(() => Promise.resolve({ rarity: 'epic', rewardXp: 25, alreadyOpened: false }));
        const tree = renderScreen(
            { ...baseParams, rewardChest: { tier: 'standard', isOpened: false } },
            { openDailyRewardChest },
        );
        pressContinue(tree);

        knock(tree);
        expect(openDailyRewardChest).toHaveBeenCalledTimes(1);
        expect(openDailyRewardChest.mock.calls[0][0]).toBe('2026-10-11');
        await flushPromises();
        knock(tree);
        // Not revealed early just because the answer is in.
        expect(textContent(tree)).not.toContain('Epic!');
        knock(tree);
        await flushPromises();

        expect(openDailyRewardChest).toHaveBeenCalledTimes(1);
        expect(textContent(tree)).toContain('Epic!');
        expect(logAppEvent).toHaveBeenCalledWith('habits_reward_chest_open', expect.objectContaining({ rarity: 'epic', xp: 25 }));
    });

    it('waits on the third knock for a slow response, then reveals', async () => {
        let resolveOpen: (value: any) => void = () => undefined;
        const openDailyRewardChest = jest.fn(() => new Promise((resolve) => { resolveOpen = resolve; }));
        const tree = renderScreen(
            { ...baseParams, rewardChest: { tier: 'standard', isOpened: false } },
            { openDailyRewardChest },
        );
        pressContinue(tree);
        knock(tree);
        knock(tree);
        knock(tree);
        expect(textContent(tree)).toContain('Opening');

        await act(async () => {
            resolveOpen({ rarity: 'common', rewardXp: 5 });
        });
        await flushPromises();

        expect(textContent(tree)).toContain('Nice!');
    });

    it('hands the chest back after a failed open, and lets the user leave', async () => {
        const openDailyRewardChest = jest.fn()
            .mockImplementationOnce(() => Promise.reject(new Error('offline')))
            .mockImplementationOnce(() => Promise.resolve({ rarity: 'rare', rewardXp: 12 }));
        const tree = renderScreen(
            { ...baseParams, rewardChest: { tier: 'standard', isOpened: false } },
            { openDailyRewardChest },
        );
        pressContinue(tree);
        knock(tree);
        await flushPromises();

        expect(textContent(tree)).toContain("couldn't open");
        // Continue is back, so a persistent failure cannot trap the user on the screen.
        expect(findButtons(tree).length).toBeGreaterThan(1);

        knock(tree);
        expect(openDailyRewardChest).toHaveBeenCalledTimes(2);
    });

    it('dismisses after the reveal', async () => {
        const navigation = buildNavigation();
        const markDailyStreakCelebrated = jest.fn(() => Promise.resolve());
        const tree = renderScreen(
            { ...baseParams, rewardChest: { tier: 'boosted', isOpened: false } },
            { navigation, markDailyStreakCelebrated, openDailyRewardChest: jest.fn(() => Promise.resolve({ rarity: 'rare', rewardXp: 14 })) },
        );
        pressContinue(tree);
        knock(tree);
        knock(tree);
        knock(tree);
        await flushPromises();

        pressContinue(tree);

        expect(markDailyStreakCelebrated).toHaveBeenCalledTimes(1);
        expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('skips a chest that was already opened', () => {
        const navigation = buildNavigation();
        const tree = renderScreen(
            { ...baseParams, rewardChest: { tier: 'standard', isOpened: true, rarity: 'rare', rewardXp: 11 } },
            { navigation },
        );

        pressContinue(tree);

        expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
});
