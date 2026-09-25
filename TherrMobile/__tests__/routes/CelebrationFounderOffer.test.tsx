import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import {
    it, describe, expect, jest, beforeEach, afterEach,
} from '@jest/globals';

/**
 * The milestone screen's founder button must count an impression whenever it is shown.
 *
 * Regression: the impression was logged from a mount-only effect. The dashboard fetches the
 * lifetime offer in parallel with the celebration, so when the offer landed after the screen
 * was up, the button appeared with no impression — and the surface's click-through read as
 * higher than it was.
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
jest.mock('../../main/utilities/getConfig', () => ({
    __esModule: true,
    default: () => ({ featureFlags: { [require('therr-js-utilities/constants').FeatureFlags.ENABLE_HABITS_LIFETIME_OFFER]: true } }),
}));

import { Celebration } from '../../main/routes/Celebration';
import { logAppEvent } from '../../main/utilities/analyticsEvents';

const milestoneParams = {
    type: 'streak',
    streak: 30,
    week: [],
    milestone: true,
    perfectWeek: false,
    newLongest: true,
    date: '2026-09-25',
};

const liveOffer = {
    isEntitled: false,
    isStoreConfigured: true,
    isSoldOut: false,
    remaining: 4200,
} as any;

const user = { settings: { locale: 'en-us', mobileThemeName: 'light' }, details: {} } as any;

const navigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
    reset: jest.fn(),
    canGoBack: jest.fn(() => true),
    isFocused: jest.fn(() => true),
};

const buildElement = (lifetimeOffer: any) => (
    <Celebration
        navigation={navigation}
        route={{ params: milestoneParams }}
        user={user}
        lifetimeOffer={lifetimeOffer}
        markDailyStreakCelebrated={jest.fn(() => Promise.resolve())}
        acknowledgePlacement={jest.fn(() => Promise.resolve())}
    />
);

const impressions = () => (logAppEvent as jest.Mock).mock.calls
    .filter(([name]) => name === 'habits_upgrade_nudge_view');

describe('Celebration — founder offer impression', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    beforeEach(() => {
        jest.useFakeTimers();
        (logAppEvent as jest.Mock).mockClear();
    });

    afterEach(() => {
        act(() => {
            tree?.unmount();
        });
        tree = undefined;
        jest.useRealTimers();
    });

    it('logs the impression when the offer arrives after the screen is up', () => {
        act(() => {
            tree = renderer.create(buildElement(null));
        });
        expect(impressions()).toHaveLength(0);

        act(() => {
            tree!.update(buildElement(liveOffer));
        });

        expect(impressions()).toEqual([['habits_upgrade_nudge_view', { source: 'celebration-milestone' }]]);
    });

    it('logs it once, not on every re-render', () => {
        act(() => {
            tree = renderer.create(buildElement(liveOffer));
        });
        act(() => {
            tree!.update(buildElement({ ...liveOffer, remaining: 4199 }));
        });

        expect(impressions()).toHaveLength(1);
    });

    it('logs nothing when no offer is ever shown', () => {
        act(() => {
            tree = renderer.create(buildElement(null));
        });

        expect(impressions()).toHaveLength(0);
    });
});
