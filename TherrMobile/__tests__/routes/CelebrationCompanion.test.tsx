import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import {
    it, describe, expect, jest, beforeEach, afterEach,
} from '@jest/globals';

/**
 * The companion stage-up celebration: it names the stage reached, says what comes next (or that
 * the chameleon is fully grown), and on the way out records the stage as seen on this device —
 * never through the streak or placement server writes.
 */
const mockLogAppEvent = jest.fn();
const mockMarkStageSeen = jest.fn((..._args: any[]) => Promise.resolve());

jest.mock('lottie-react-native', () => 'LottieView');
jest.mock('../../main/utilities/rewardFeedback', () => ({
    __esModule: true,
    triggerRewardCelebration: () => () => undefined,
    triggerCompanionTapFeedback: () => undefined,
}));
jest.mock('../../main/utilities/analyticsEvents', () => ({
    __esModule: true,
    logAppEvent: (...args: any[]) => mockLogAppEvent(...args),
}));
jest.mock('../../main/utilities/celebrationQueue', () => ({
    __esModule: true,
    default: { onDismissed: jest.fn() },
}));
jest.mock('../../main/utilities/companionCelebration', () => ({
    __esModule: true,
    markStageSeen: (...args: any[]) => mockMarkStageSeen(...args),
}));

import { Celebration } from '../../main/routes/Celebration';

const buildNavigation = () => ({
    goBack: jest.fn(),
    navigate: jest.fn(),
    reset: jest.fn(),
    canGoBack: jest.fn(() => true),
    isFocused: jest.fn(() => true),
});

let mounted: renderer.ReactTestRenderer | undefined;

const renderScreen = (params: any, navigation = buildNavigation()) => {
    const markDailyStreakCelebrated = jest.fn(() => Promise.resolve());
    const acknowledgePlacement = jest.fn(() => Promise.resolve());
    act(() => {
        mounted = renderer.create(
            <Celebration
                navigation={navigation}
                route={{ params }}
                user={{ settings: { locale: 'en-us', mobileThemeName: 'light' }, details: {} } as any}
                lifetimeOffer={null}
                markDailyStreakCelebrated={markDailyStreakCelebrated}
                acknowledgePlacement={acknowledgePlacement}
            />,
        );
    });
    return { tree: mounted!, navigation, markDailyStreakCelebrated, acknowledgePlacement };
};

const allText = (tree: renderer.ReactTestRenderer) => tree.root
    .findAll((node) => typeof node.props.children === 'string')
    .map((node) => node.props.children as string);

const pressContinue = (tree: renderer.ReactTestRenderer) => {
    const buttons = tree.root.findAll((node) => typeof node.type !== 'string'
        && node.props.accessibilityRole === 'button'
        && typeof node.props.onPress === 'function');
    act(() => {
        buttons[buttons.length - 1].props.onPress();
    });
};

const hatch = {
    type: 'companion', userId: 'user-1', stageId: 'hatchling', stageIndex: 1, fromStageId: 'egg', fromStageIndex: 0,
};

describe('Celebration — companion stage-up', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockLogAppEvent.mockClear();
        mockMarkStageSeen.mockClear();
    });

    afterEach(() => {
        act(() => {
            mounted?.unmount();
        });
        mounted = undefined;
        jest.useRealTimers();
    });

    it('announces a hatching and what the next stage is', () => {
        const { tree } = renderScreen(hatch);
        const text = allText(tree);

        expect(text).toContain('Your egg hatched!');
        expect(text).toContain('Hatchling');
        expect(text).toContain('Stage 2 of 5');
        expect(text).toContain('Next: Little Climber');
        expect(mockLogAppEvent).toHaveBeenCalledWith('habits_companion_stage_up', expect.objectContaining({
            stage: 'hatchling', from_stage: 'egg',
        }));
    });

    it('calls the final stage fully grown', () => {
        const { tree } = renderScreen({
            ...hatch, stageId: 'champion', stageIndex: 4, fromStageId: 'adult', fromStageIndex: 3,
        });
        const text = allText(tree);

        expect(text).toContain('Your habit buddy grew!');
        expect(text).toContain('Change Champion');
        expect(text.some((t) => t.startsWith('Fully grown'))).toBe(true);
    });

    it('records the stage as seen on this device and leaves, without the streak or placement writes', () => {
        const { tree, navigation, markDailyStreakCelebrated, acknowledgePlacement } = renderScreen(hatch);

        pressContinue(tree);

        expect(mockMarkStageSeen).toHaveBeenCalledWith('user-1', 1);
        expect(markDailyStreakCelebrated).not.toHaveBeenCalled();
        expect(acknowledgePlacement).not.toHaveBeenCalled();
        expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
});
