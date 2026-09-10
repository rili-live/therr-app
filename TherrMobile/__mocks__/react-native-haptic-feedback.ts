/**
 * Jest mock for `react-native-haptic-feedback`.
 *
 * The real package calls `TurboModuleRegistry.getEnforcing('RNHapticFeedback')`
 * at import time, which throws under Jest. Mirrors the package's enum values
 * (they are string enums whose values equal their keys) so assertions written
 * against `HapticFeedbackTypes` behave identically to production.
 */
export const HapticFeedbackTypes = {
    selection: 'selection',
    impactLight: 'impactLight',
    impactMedium: 'impactMedium',
    impactHeavy: 'impactHeavy',
    rigid: 'rigid',
    soft: 'soft',
    notificationSuccess: 'notificationSuccess',
    notificationWarning: 'notificationWarning',
    notificationError: 'notificationError',
    clockTick: 'clockTick',
    contextClick: 'contextClick',
    keyboardPress: 'keyboardPress',
    keyboardRelease: 'keyboardRelease',
    keyboardTap: 'keyboardTap',
    longPress: 'longPress',
    textHandleMove: 'textHandleMove',
    virtualKey: 'virtualKey',
    virtualKeyRelease: 'virtualKeyRelease',
    effectClick: 'effectClick',
    effectDoubleClick: 'effectDoubleClick',
    effectHeavyClick: 'effectHeavyClick',
    effectTick: 'effectTick',
} as const;

export const trigger = jest.fn();

export default { trigger };
