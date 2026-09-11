import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, jest } from '@jest/globals';
import { BrandVariations } from 'therr-js-utilities/constants';

/**
 * Brand-relative, like `brandSurfaceConsistency`: the same assertions run on `general`
 * and on `niche/HABITS-general`, and each brand is held to its own loader.
 *
 * On Friends with Habits every loader entry point must resolve to the chameleon and
 * never to a Lottie, because every Lottie in the set is Therr's (the wordmark, a globe,
 * a taco). On Therr the Lottie set must still be what renders — the chameleon is a
 * Habits mark and must not leak.
 */
jest.mock('lottie-react-native', () => 'LottieView');
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
        useAnimatedProps: (factory: any) => factory(),
        withTiming: (toValue: number) => toValue,
        withSequence: (...animations: any[]) => animations[animations.length - 1],
        withRepeat: (animation: any) => animation,
        cancelAnimation: () => undefined,
        interpolate: (_value: number, _input: number[], output: number[]) => output[0],
        interpolateColor: (_value: number, _input: number[], output: string[]) => output[0],
        Easing: { linear: undefined, inOut: () => undefined, quad: undefined },
        ReduceMotion: { System: 'system' },
    };
});

import LottieLoader, { ILottieId } from '../../main/components/LottieLoader';
import EarthLoader from '../../main/components/Loaders/EarthLoader';
import { CURRENT_BRAND_VARIATION } from '../../main/config/brandConfig';
import { buildStyles as buildLoaderStyles } from '../../main/styles/loaders';

const theme = buildLoaderStyles('light');
const isHabits = CURRENT_BRAND_VARIATION === BrandVariations.HABITS;

const render = (element: React.ReactElement) => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
        tree = renderer.create(element);
    });
    return tree!;
};

const countLotties = (tree: renderer.ReactTestRenderer) => tree.root.findAllByType('LottieView' as any).length;
const countChameleons = (tree: renderer.ReactTestRenderer) => tree.root.findAll(
    (node) => node.props.testID === 'chameleon-loader' && typeof node.type === 'string',
).length;

// Every id a screen can ask for, including the Therr wordmark and the ones the
// content feeds pick from at random.
const ALL_IDS: ILottieId[] = [
    'claim-a-space', 'donut', 'earth', 'taco', 'shopping', 'happy-swing', 'karaoke', 'yellow-car', 'zeppelin', 'therr-black-rolling',
];

describe('LottieLoader', () => {
    it.each(ALL_IDS)(`renders the ${isHabits ? 'chameleon' : 'Lottie'} for "%s" on ${CURRENT_BRAND_VARIATION}`, (id) => {
        const tree = render(<LottieLoader id={id} theme={theme} />);

        expect(countChameleons(tree)).toBe(isHabits ? 1 : 0);
        expect(countLotties(tree)).toBe(isHabits ? 0 : 1);
    });

    it('keeps the loading caption alongside the chameleon', () => {
        const tree = render(<LottieLoader id="earth" theme={theme} />);

        expect(tree.root.findAll(
            (node) => typeof node.type === 'string' && node.props.children === 'Loading...',
        )).toHaveLength(1);
    });
});

describe('EarthLoader', () => {
    it(`renders the ${isHabits ? 'chameleon' : 'globe'} overlay on ${CURRENT_BRAND_VARIATION}`, () => {
        const tree = render(<EarthLoader visible={true} speed={1.5} />);

        expect(countChameleons(tree)).toBe(isHabits ? 1 : 0);
        expect(countLotties(tree)).toBe(isHabits ? 0 : 1);
    });

    it('renders nothing while hidden', () => {
        const tree = render(<EarthLoader visible={false} speed={1} />);

        expect(tree.toJSON()).toBeNull();
    });
});
