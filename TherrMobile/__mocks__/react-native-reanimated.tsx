import React from 'react';
import { ScrollView, Text, View } from 'react-native';

/**
 * Reanimated's worklets runtime installs JSI bindings at import time
 * (`react-native-worklets/src/WorkletsModule/NativeWorklets.native.ts`), which throws under
 * Jest and takes down the whole suite — the same failure class as the audio, haptics and
 * keyboard-controller mocks alongside this one. Any suite whose module graph reaches
 * `components/Habits` now reaches it too, via the chameleon in `HabitsListLoader`.
 *
 * The mock reanimated ships (`react-native-reanimated/mock`) is not usable here: on v4 it
 * re-exports from the package's own `src/index`, so requiring it initialises the very runtime
 * it is supposed to stand in for.
 *
 * Animation is a native behaviour with nothing to assert in a unit test, so every animated
 * value collapses to its final state: `withTiming`/`withRepeat` resolve to the value they
 * animate toward, a sequence resolves to its last step, and the interpolators return the first
 * output stop. That keeps a component's first frame renderable and deterministic, which is all
 * these suites need — they render screens that *contain* an animation, they do not test one.
 */

const identity = <T,>(value: T): T => value;

export const useSharedValue = <T,>(initial: T) => React.useRef({ value: initial }).current;

/**
 * Runs the worklet once, on the values the shared refs currently hold, and hands back the props
 * it produced. Calling it (rather than returning `{}`) is what keeps the callback itself covered:
 * a worklet that throws on its first frame still fails the render here.
 */
export const useAnimatedProps = (updater: () => any) => updater();
export const useAnimatedStyle = (updater: () => any) => updater();
export const useDerivedValue = (updater: () => any) => ({ value: updater() });

export const withTiming = identity;
export const withSpring = identity;
export const withDelay = (_delay: number, animation: any) => animation;
export const withRepeat = (animation: any) => animation;
export const withSequence = (...animations: any[]) => animations[animations.length - 1];
export const cancelAnimation = () => {};
export const runOnJS = (fn: any) => fn;
export const runOnUI = (fn: any) => fn;

export const interpolate = (_value: number, _input: number[], output: number[]) => output[0];
export const interpolateColor = (_value: number, _input: number[], output: string[]) => output[0];

const easingFn = (t: number) => t;
const easingFactory = () => easingFn;

export const Easing = {
    linear: easingFn,
    ease: easingFn,
    quad: easingFn,
    cubic: easingFn,
    sin: easingFn,
    exp: easingFn,
    circle: easingFn,
    in: easingFactory,
    out: easingFactory,
    inOut: easingFactory,
    bezier: easingFactory,
};

export const ReduceMotion = {
    System: 'system',
    Always: 'always',
    Never: 'never',
};

const Animated = {
    View,
    Text,
    ScrollView,
    createAnimatedComponent: <T,>(Component: T): T => Component,
};

export default Animated;
