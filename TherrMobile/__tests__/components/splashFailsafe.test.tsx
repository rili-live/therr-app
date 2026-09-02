import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import {
    it, describe, expect, jest, beforeEach, afterEach,
} from '@jest/globals';

/**
 * `SplashLogoSpinner` renders an `absoluteFill` overlay at `zIndex: 9999` across the whole
 * NavigationContainer, and the only thing that used to take it down was a reanimated
 * completion callback. Those callbacks run with `finished: false` when an animation is
 * interrupted rather than completed, and on that path nothing called `fadeOut`, nothing
 * called `finish`, and the app sat under an opaque sheet until the user force-killed it.
 * It is a cold-start path, so a stuck frame is indistinguishable from a launch crash.
 *
 * These tests drive the two halves of that: an animation whose callbacks never arrive (the
 * hang), and one that completes normally (the failsafe must not double-fire behind it).
 *
 * `mockShouldInvokeCallbacks` is what separates them — reanimated is stubbed either way, and
 * the flag decides whether the stub's `withTiming` honours the completion callback it is
 * handed. `jest.mock` factories may only close over names prefixed `mock`, hence the name.
 */
let mockShouldInvokeCallbacks = false;

jest.mock('react-native-reanimated', () => {
    const { View, Image } = require('react-native');
    const maybeInvoke = (callback?: any) => {
        if (mockShouldInvokeCallbacks && typeof callback === 'function') {
            callback(true);
        }
    };

    return {
        __esModule: true,
        default: { View, Image, createAnimatedComponent: (Component: any) => Component },
        useSharedValue: (value: number) => ({ value }),
        useAnimatedStyle: (factory: any) => factory(),
        withTiming: (toValue: number, _config?: any, callback?: any) => {
            maybeInvoke(callback);

            return toValue;
        },
        withSequence: (...animations: any[]) => animations[animations.length - 1],
        runOnJS: (fn: any) => fn,
        Easing: {
            in: () => undefined, out: () => undefined, inOut: () => undefined, quad: undefined,
        },
    };
});

import SplashLogoSpinner, { SPLASH_FAILSAFE_MS } from '../../main/components/SplashLogoSpinner';

describe('SplashLogoSpinner failsafe', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockShouldInvokeCallbacks = false;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const renderSpinner = (start: boolean, onAnimationComplete: () => void) => {
        let tree: any;

        act(() => {
            tree = renderer.create(
                <SplashLogoSpinner start={start} onAnimationComplete={onAnimationComplete} />,
            );
        });

        return tree;
    };

    it('hides the splash when the animation callback never arrives', () => {
        const onAnimationComplete = jest.fn();
        renderSpinner(true, onAnimationComplete);

        // The animation is hung: nothing has completed it.
        expect(onAnimationComplete).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(SPLASH_FAILSAFE_MS);
        });

        expect(onAnimationComplete).toHaveBeenCalledTimes(1);
    });

    it('leaves the overlay up for the whole animation budget before firing', () => {
        const onAnimationComplete = jest.fn();
        renderSpinner(true, onAnimationComplete);

        // One tick short: the failsafe must not cut a slow-but-working animation off.
        act(() => {
            jest.advanceTimersByTime(SPLASH_FAILSAFE_MS - 1);
        });

        expect(onAnimationComplete).not.toHaveBeenCalled();
    });

    it('does not fire a second time when the animation completed normally', () => {
        mockShouldInvokeCallbacks = true;
        const onAnimationComplete = jest.fn();
        renderSpinner(true, onAnimationComplete);

        expect(onAnimationComplete).toHaveBeenCalledTimes(1);

        // The pending failsafe must not re-hide an already-hidden splash.
        act(() => {
            jest.advanceTimersByTime(SPLASH_FAILSAFE_MS * 2);
        });

        expect(onAnimationComplete).toHaveBeenCalledTimes(1);
    });

    it('arms nothing until start flips true', () => {
        const onAnimationComplete = jest.fn();
        renderSpinner(false, onAnimationComplete);

        act(() => {
            jest.advanceTimersByTime(SPLASH_FAILSAFE_MS * 2);
        });

        // `Layout` holds `start` false until NavigationContainer.onReady resolves; a failsafe
        // armed on mount would race image prefetch and tear the splash down early.
        expect(onAnimationComplete).not.toHaveBeenCalled();
    });

    it('clears the failsafe on unmount', () => {
        const onAnimationComplete = jest.fn();
        const tree = renderSpinner(true, onAnimationComplete);

        act(() => {
            tree.unmount();
        });

        act(() => {
            jest.advanceTimersByTime(SPLASH_FAILSAFE_MS * 2);
        });

        expect(onAnimationComplete).not.toHaveBeenCalled();
    });
});
