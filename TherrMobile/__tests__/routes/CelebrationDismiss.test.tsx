import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import {
    it, describe, expect, jest, beforeEach, afterEach,
} from '@jest/globals';

/**
 * The celebration screen must always let the user out.
 *
 * Regression: `dismiss` set a one-shot flag before calling `navigation.goBack()`. When that pop
 * did not happen (the screen was the root of the stack, or the dismiss write threw first), the
 * flag stayed set and every later press of Continue — and the hardware back — returned early.
 * The user was stuck on the streak screen until they killed the app.
 */
jest.mock('lottie-react-native', () => 'LottieView');
jest.mock('../../main/utilities/rewardFeedback', () => ({
    __esModule: true,
    triggerRewardCelebration: () => () => undefined,
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

const streakParams = {
    type: 'streak',
    streak: 17,
    week: [],
    milestone: false,
    perfectWeek: false,
    newLongest: true,
    date: '2026-09-25',
};

const buildNavigation = (overrides: Record<string, any> = {}) => ({
    goBack: jest.fn(),
    navigate: jest.fn(),
    reset: jest.fn(),
    canGoBack: jest.fn(() => true),
    isFocused: jest.fn(() => true),
    ...overrides,
});

let mounted: renderer.ReactTestRenderer | undefined;

const renderScreen = (navigation: any, markDailyStreakCelebrated: any) => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(
            <Celebration
                navigation={navigation}
                route={{ params: streakParams }}
                user={{ settings: { locale: 'en-us', mobileThemeName: 'light' }, details: {} } as any}
                lifetimeOffer={null}
                markDailyStreakCelebrated={markDailyStreakCelebrated}
                acknowledgePlacement={jest.fn(() => Promise.resolve())}
            />,
        );
    });
    mounted = tree!;
    return tree!;
};

const pressContinue = (tree: renderer.ReactTestRenderer) => {
    const buttons = tree.root.findAll((node) => typeof node.type !== 'string'
        && node.props.accessibilityRole === 'button'
        && typeof node.props.onPress === 'function');
    act(() => {
        buttons[buttons.length - 1].props.onPress();
    });
};

describe('Celebration — dismiss', () => {
    let markDailyStreakCelebrated: any;

    beforeEach(() => {
        // The entrance animation runs on timers; keep them from firing after teardown.
        jest.useFakeTimers();
        markDailyStreakCelebrated = jest.fn(() => Promise.resolve());
    });

    afterEach(() => {
        act(() => {
            mounted?.unmount();
        });
        mounted = undefined;
        jest.useRealTimers();
    });

    it('records the dismissal once and goes back', () => {
        const navigation = buildNavigation();
        const tree = renderScreen(navigation, markDailyStreakCelebrated);

        pressContinue(tree);

        expect(markDailyStreakCelebrated).toHaveBeenCalledTimes(1);
        expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('ignores a second tap once the pop has landed, so the screen beneath is not popped too', () => {
        const navigation = buildNavigation();
        const tree = renderScreen(navigation, markDailyStreakCelebrated);

        pressContinue(tree);
        navigation.isFocused.mockReturnValue(false);
        pressContinue(tree);

        expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('retries the exit when the first press did not leave the screen', () => {
        const navigation = buildNavigation();
        const tree = renderScreen(navigation, markDailyStreakCelebrated);

        pressContinue(tree);
        // Still focused: the first goBack was not handled.
        pressContinue(tree);

        expect(navigation.goBack).toHaveBeenCalledTimes(2);
        // The server write is still sent exactly once.
        expect(markDailyStreakCelebrated).toHaveBeenCalledTimes(1);
    });

    it('resets to the landing screen when there is nothing to go back to', () => {
        const navigation = buildNavigation({ canGoBack: jest.fn(() => false) });
        const tree = renderScreen(navigation, markDailyStreakCelebrated);

        pressContinue(tree);

        expect(navigation.goBack).not.toHaveBeenCalled();
        expect(navigation.reset).toHaveBeenCalledWith(expect.objectContaining({ index: 0 }));
    });

    it('still leaves when recording the dismissal throws', () => {
        const navigation = buildNavigation();
        const throwing = jest.fn(() => {
            throw new Error('boom');
        });
        const tree = renderScreen(navigation, throwing);

        pressContinue(tree);

        expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
});
