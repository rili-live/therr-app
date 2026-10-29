import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import {
    it, describe, expect, jest, beforeEach, afterEach,
} from '@jest/globals';

/**
 * The daily-bonus stage of the streak celebration: the chameleon reveal.
 *
 * The bonus is paid server-side at check-in, so the reveal is decoration and must behave like
 * it: Continue leads to it rather than out, Continue stays available on it (skipping costs
 * nothing, and there is no request to wait on), and three taps reveal exactly the amount the
 * server paid.
 */
jest.mock('lottie-react-native', () => 'LottieView');
jest.mock('react-native-svg', () => {
    const ReactForMock = require('react');
    const stub = (name: string) => (props: any) => ReactForMock.createElement(name, props, props.children);
    return {
        __esModule: true,
        default: stub('Svg'),
        Circle: stub('Circle'),
        Path: stub('Path'),
        Polygon: stub('Polygon'),
    };
});
jest.mock('../../main/utilities/rewardFeedback', () => ({
    __esModule: true,
    triggerRewardCelebration: () => () => undefined,
    triggerTongueFlickFeedback: jest.fn(),
    triggerGemBurstFeedback: jest.fn(() => () => undefined),
}));
jest.mock('../../main/utilities/analyticsEvents', () => ({
    __esModule: true,
    logAppEvent: jest.fn(),
}));
jest.mock('../../main/utilities/celebrationQueue', () => ({
    __esModule: true,
    default: { onDismissed: jest.fn() },
}));

import { Celebration, getBonusTitleKey } from '../../main/routes/Celebration';
import { getGemCount } from '../../main/components/Celebrations/ChameleonCatch';
import { logAppEvent } from '../../main/utilities/analyticsEvents';
import { triggerGemBurstFeedback, triggerTongueFlickFeedback } from '../../main/utilities/rewardFeedback';

const baseParams = {
    type: 'streak',
    streak: 4,
    week: [],
    milestone: false,
    perfectWeek: false,
    newLongest: false,
    date: '2026-10-11',
};
const withBonus = { ...baseParams, dailyBonus: { tier: 'standard', rarity: 'epic', bonusXp: 25 } };

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
            />,
        );
    });
    mounted = tree!;
    return tree!;
};

const findButtons = (tree: renderer.ReactTestRenderer) => tree.root.findAll((node) => typeof node.type !== 'string'
    && node.props.accessibilityRole === 'button'
    && typeof node.props.onPress === 'function');

const findChameleon = (tree: renderer.ReactTestRenderer) => findButtons(tree)
    .find((node) => String(node.props.accessibilityLabel || '').startsWith('Chameleon'));

const pressContinue = (tree: renderer.ReactTestRenderer) => {
    const buttons = findButtons(tree);
    act(() => {
        buttons[buttons.length - 1].props.onPress();
    });
};

const tapChameleon = (tree: renderer.ReactTestRenderer) => {
    act(() => {
        findChameleon(tree)?.props.onPress();
    });
    // Let the tongue animation run out, then the burst and count-up the catch starts.
    act(() => {
        jest.runAllTimers();
    });
    act(() => {
        jest.runAllTimers();
    });
};

const textContent = (tree: renderer.ReactTestRenderer) => tree.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''))
    .join(' | ');

describe('Celebration — daily bonus reveal', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        (logAppEvent as any).mockClear();
        (triggerTongueFlickFeedback as any).mockClear();
        (triggerGemBurstFeedback as any).mockClear();
    });

    afterEach(() => {
        act(() => {
            mounted?.unmount();
        });
        mounted = undefined;
        jest.useRealTimers();
    });

    it('leads Continue to the chameleon, with Continue still available there', () => {
        const markDailyStreakCelebrated = jest.fn(() => Promise.resolve());
        const tree = renderScreen(withBonus, { markDailyStreakCelebrated });

        pressContinue(tree);

        expect(markDailyStreakCelebrated).not.toHaveBeenCalled();
        expect(findChameleon(tree)).toBeTruthy();
        // The chameleon and Continue: skipping the reveal is always possible.
        expect(findButtons(tree)).toHaveLength(2);
        expect(textContent(tree)).toContain('Tap to unlock your daily bonus');
        expect(textContent(tree)).not.toContain('already yours');
    });

    it('lets the user skip the reveal without tapping — the bonus is already paid', () => {
        const navigation = buildNavigation();
        const markDailyStreakCelebrated = jest.fn(() => Promise.resolve());
        const tree = renderScreen(withBonus, { navigation, markDailyStreakCelebrated });

        pressContinue(tree);
        pressContinue(tree);

        expect(markDailyStreakCelebrated).toHaveBeenCalledTimes(1);
        expect(navigation.goBack).toHaveBeenCalledTimes(1);
        expect(triggerGemBurstFeedback).not.toHaveBeenCalled();
    });

    it('reveals the paid amount on the third tap, and not before', () => {
        const tree = renderScreen(withBonus);
        pressContinue(tree);

        tapChameleon(tree);
        tapChameleon(tree);
        expect(textContent(tree)).not.toContain('Brilliant!');
        tapChameleon(tree);

        expect(triggerTongueFlickFeedback).toHaveBeenCalledTimes(3);
        expect(triggerGemBurstFeedback).toHaveBeenCalledWith('epic');
        expect(textContent(tree)).toContain('Brilliant!');
        expect(textContent(tree)).toContain('+25 XP');
        expect(logAppEvent).toHaveBeenCalledWith('habits_daily_bonus_reveal', expect.objectContaining({ rarity: 'epic', xp: 25 }));
    });

    it('ignores taps after the catch', () => {
        const tree = renderScreen(withBonus);
        pressContinue(tree);
        tapChameleon(tree);
        tapChameleon(tree);
        tapChameleon(tree);
        tapChameleon(tree);

        expect(triggerTongueFlickFeedback).toHaveBeenCalledTimes(3);
        expect(triggerGemBurstFeedback).toHaveBeenCalledTimes(1);
    });

    it('goes straight out when there is no bonus to reveal', () => {
        const navigation = buildNavigation();
        const tree = renderScreen(baseParams, { navigation });

        pressContinue(tree);

        expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });
});

describe('ChameleonCatch — gem count', () => {
    it('scales with the bonus within a readable burst', () => {
        expect(getGemCount(3)).toBe(5);
        expect(getGemCount(25)).toBe(8);
        expect(getGemCount(50)).toBe(16);
    });
});

describe('Celebration — bonus heading', () => {
    // The comeback tier is what the comeback push promised; it must be named as that bonus, and
    // a tier this build does not know must fall back to the ordinary heading, never to nothing.
    it('names the comeback bonus, and falls back for an unknown tier', () => {
        expect(getBonusTitleKey('comeback')).toBe('pages.celebration.bonus.titleComeback');
        expect(getBonusTitleKey('boosted')).toBe('pages.celebration.bonus.titleBoosted');
        expect(getBonusTitleKey('standard')).toBe('pages.celebration.bonus.title');
        expect(getBonusTitleKey('mythic')).toBe('pages.celebration.bonus.title');
        expect(getBonusTitleKey(undefined)).toBe('pages.celebration.bonus.title');
    });
});
