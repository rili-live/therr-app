/**
 * Jest mock for `react-native-edge-to-edge`.
 *
 * Rendering the real `SystemBars` schedules a `setImmediate` that reads
 * `Platform.OS` when it fires. Under Jest that callback lands after the test
 * has finished and the module registry has been torn down, which crashes the
 * worker rather than failing a test. Any suite that renders `BaseStatusBar`
 * (i.e. any full screen) hits it, so the mock lives here rather than in each
 * test file.
 */
import React from 'react';

export const SystemBars = () => null;

export const SystemBarsEntry = jest.fn();

export const setSystemBarsStyle = jest.fn();

export const SystemBarsProvider = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

export default { SystemBars };
