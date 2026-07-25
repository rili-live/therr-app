import { NativeModules as RNNativeModules } from 'react-native';

// Jest's jsdom environment stopped exposing `setImmediate` in v27, but React Native core
// still uses it (LogBox's ignore-pattern queue calls it at import time, so merely importing
// App.tsx throws without this). Node provides the real thing — hand it to the sandbox rather
// than approximating it with setTimeout, which has different ordering semantics.
if (typeof globalThis.setImmediate === 'undefined') {
    globalThis.setImmediate = require('timers').setImmediate;
    globalThis.clearImmediate = require('timers').clearImmediate;
}

RNNativeModules.UIManager = RNNativeModules.UIManager || {};
RNNativeModules.UIManager.RCTView = RNNativeModules.UIManager.RCTView || {};
RNNativeModules.RNGestureHandlerModule = RNNativeModules.RNGestureHandlerModule || {
    State: { BEGAN: 'BEGAN', FAILED: 'FAILED', ACTIVE: 'ACTIVE', END: 'END' },
    attachGestureHandler: jest.fn(),
    createGestureHandler: jest.fn(),
    dropGestureHandler: jest.fn(),
    updateGestureHandler: jest.fn(),
};
RNNativeModules.PlatformConstants = RNNativeModules.PlatformConstants || {
    forceTouchAvailable: false,
};
