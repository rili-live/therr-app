import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';

/**
 * `ChameleonLoader` is the loader every Friends with Habits screen shows, so what
 * matters is that it always mounts, takes every colour from the theme it is handed,
 * and stops its animations when it unmounts — a loader is torn down the moment the
 * data it was waiting for arrives, and a repeat animation that outlives its view is
 * a leak on every fetch.
 *
 * reanimated is stubbed to plain values: the animation itself is not under test, the
 * wiring is. `jest.mock` factories may only close over names prefixed `mock`.
 */
const mockCancelAnimation = jest.fn();
/** Every callback handed to useAnimatedProps, so the worklet check below can inspect it. */
const mockAnimatedPropsFactories: Function[] = [];

jest.mock('react-native-reanimated', () => {
    const { View } = require('react-native');
    const ReactForMock = require('react');
    // Spread `animatedProps` onto the element so the at-rest values are what render.
    const createAnimatedComponent = (Component: any) => ({ animatedProps, ...props }: any) => (
        ReactForMock.createElement(Component, { ...props, ...animatedProps })
    );

    return {
        __esModule: true,
        default: { View, createAnimatedComponent },
        useSharedValue: (value: number) => ({ value }),
        useAnimatedProps: (factory: any) => {
            mockAnimatedPropsFactories.push(factory);
            return factory();
        },
        withTiming: (toValue: number) => toValue,
        withSequence: (...animations: any[]) => animations[animations.length - 1],
        withRepeat: (animation: any) => animation,
        cancelAnimation: (...args: any[]) => mockCancelAnimation(...args),
        interpolate: (value: number, input: number[], output: number[]) => output[input.indexOf(value)] ?? output[0],
        interpolateColor: (_value: number, _input: number[], output: string[]) => output[0],
        Easing: { linear: undefined, inOut: () => undefined, quad: undefined },
        ReduceMotion: { System: 'system' },
    };
});

import { Circle, Path } from 'react-native-svg';
import ChameleonLoader from '../../main/components/Loaders/ChameleonLoader';
import { buildStyles as buildLoaderStyles } from '../../main/styles/loaders';

const theme = buildLoaderStyles('light');

// react-native-svg turns `fill` into an internal brush on the host node, so read it
// off the shape components, where it is still the colour string the theme supplied.
const isShape = (node: renderer.ReactTestInstance) => node.type === Path || node.type === Circle;
const findByFill = (tree: renderer.ReactTestRenderer, fill: string) => tree.root.findAll(
    (node) => isShape(node) && node.props.fill === fill,
);

describe('ChameleonLoader', () => {
    beforeEach(() => {
        mockCancelAnimation.mockClear();
        mockAnimatedPropsFactories.length = 0;
    });

    it('hands useAnimatedProps only compiled worklets (release 1.7.0 crashed on a plain closure)', () => {
        // babel-jest runs react-native-worklets/plugin (babel.config.js), which stamps
        // __workletHash on every function it compiles for the UI runtime. A callback
        // built by a factory — `useAnimatedProps(gaze(LEFT_PUPIL))` — is a plain JS
        // function the plugin never sees, and on device the UI runtime's first frame
        // dies with "[Worklets] Tried to synchronously call a Remote Function".
        act(() => {
            renderer.create(<ChameleonLoader theme={theme} />);
        });

        // Head, two eye sockets, two pupils, two highlights.
        expect(mockAnimatedPropsFactories).toHaveLength(7);
        mockAnimatedPropsFactories.forEach((factory) => {
            expect(typeof (factory as any).__workletHash).toBe('number');
        });
    });

    it('renders at the requested width and the logo aspect', () => {
        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(<ChameleonLoader size={80} theme={theme} />);
        });

        const frame = tree!.root.findByProps({ testID: 'chameleon-loader' });
        const style = Array.isArray(frame.props.style) ? Object.assign({}, ...frame.props.style) : frame.props.style;

        expect(style.width).toBe(80);
        expect(style.height).toBeCloseTo(80 * (580 / 724), 5);
    });

    it('draws with the theme palette rather than baked colours', () => {
        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(<ChameleonLoader theme={theme} />);
        });

        // Skin at rest is the brand colour; the stripe is the accent; eye whites and ink
        // are the branding white/black. None of these is a literal in the component.
        expect(findByFill(tree!, theme.colors.brand).length).toBeGreaterThanOrEqual(3);
        expect(findByFill(tree!, theme.colors.accent)).toHaveLength(1);
        expect(findByFill(tree!, theme.colors.brandingWhite).length).toBeGreaterThanOrEqual(2);
        expect(findByFill(tree!, theme.colors.brandingBlack).length).toBeGreaterThanOrEqual(2);
    });

    it('starts the pupils centred in the eyes', () => {
        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(<ChameleonLoader theme={theme} />);
        });

        const pupils = tree!.root.findAll((node) => isShape(node) && node.props.r === 44);

        expect(pupils.map((pupil) => [pupil.props.cx, pupil.props.cy])).toEqual([[280, 517], [744, 517]]);
    });

    it('cancels both looping animations on unmount', () => {
        let tree: renderer.ReactTestRenderer;
        act(() => {
            tree = renderer.create(<ChameleonLoader theme={theme} />);
        });
        expect(mockCancelAnimation).not.toHaveBeenCalled();

        act(() => {
            tree!.unmount();
        });

        expect(mockCancelAnimation).toHaveBeenCalledTimes(2);
    });
});
