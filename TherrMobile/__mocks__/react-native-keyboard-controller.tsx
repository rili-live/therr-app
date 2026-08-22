import React from 'react';
import { ScrollView, View } from 'react-native';

/**
 * The real package reaches for its native module at import time (see
 * `lib/commonjs/bindings.native.ts`), which throws "doesn't seem to be linked" under Jest and
 * takes down any suite that transitively imports `App.tsx`.
 *
 * Keyboard avoidance is a native layout behavior with nothing to assert in a unit test, so the
 * components the app uses are stubbed as plain pass-through containers. `ScrollView` is
 * used for the scroll variant rather than `View` so that tests can still find scrollables and
 * so children render the same way they do in the app.
 */
export const KeyboardProvider = ({ children }: any) => <>{children}</>;

export const KeyboardAvoidingView = ({ children, ...props }: any) => (
    <View {...props}>{children}</View>
);

export const KeyboardAwareScrollView = ({ children, ...props }: any) => (
    <ScrollView {...props}>{children}</ScrollView>
);

export const KeyboardStickyView = ({ children, ...props }: any) => (
    <View {...props}>{children}</View>
);

export const KeyboardController = {
    dismiss: jest.fn(() => Promise.resolve()),
    setInputMode: jest.fn(),
    setDefaultMode: jest.fn(),
};

/**
 * The real hook takes an optional selector and returns that slice of keyboard state. Under Jest
 * the keyboard is always closed, so the full closed state is fed through the selector rather than
 * returning a fixed value — a component selecting `height` gets a number, not `false`.
 */
const CLOSED_KEYBOARD_STATE = {
    isVisible: false,
    height: 0,
    duration: 0,
    timestamp: 0,
    target: -1,
    type: 'default',
    appearance: 'default',
};

export const useKeyboardState = jest.fn(
    (selector?: (state: typeof CLOSED_KEYBOARD_STATE) => any) => (selector ? selector(CLOSED_KEYBOARD_STATE) : CLOSED_KEYBOARD_STATE),
);

export const useKeyboardHandler = jest.fn();
export const useKeyboardAnimation = jest.fn(() => ({ height: { value: 0 }, progress: { value: 0 } }));
export const useReanimatedKeyboardAnimation = jest.fn(() => ({ height: { value: 0 }, progress: { value: 0 } }));
