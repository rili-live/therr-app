import {
    it, describe, expect, jest, beforeEach, afterEach,
} from '@jest/globals';

/**
 * The onboarding overlay decides from the `habits` Redux slice, which is not
 * persisted, so on a cold start it renders the full-screen call to action at an
 * established user until the first fetch resolves. This cache is what removes
 * that flash, which makes three properties load-bearing:
 *
 *   1. Reads are synchronous — an async answer arrives after the first paint,
 *      which is the flash it is meant to remove.
 *   2. Keys are per-user, so a second account on the same device still gets the
 *      real overlay.
 *   3. MMKV being unavailable degrades to "no cached answer" rather than
 *      throwing. It is a JSI module, so an unrebuilt native project would
 *      otherwise take the whole dashboard down at import time.
 */

const mockStore: Record<string, boolean> = {};
let mockReadWriteThrows = false;
let mockConstructorThrows = false;

jest.mock('react-native-mmkv', () => ({
    MMKV: jest.fn().mockImplementation(() => {
        if (mockConstructorThrows) {
            throw new Error('JSI bindings unavailable');
        }
        return {
            getBoolean: (key: string) => {
                if (mockReadWriteThrows) {
                    throw new Error('mmkv read failed');
                }
                return mockStore[key];
            },
            set: (key: string, value: boolean) => {
                if (mockReadWriteThrows) {
                    throw new Error('mmkv write failed');
                }
                mockStore[key] = value;
            },
            delete: (key: string) => { delete mockStore[key]; },
        };
    }),
}));

// The module memoizes its MMKV handle on first use, so each case re-imports it
// through an isolated registry rather than sharing one resolved handle.
const loadCache = () => {
    let mod: any;
    jest.isolateModules(() => {
        mod = require('../../main/utilities/habitsOnboardingCache');
    });
    return mod;
};

describe('habitsOnboardingCache', () => {
    beforeEach(() => {
        Object.keys(mockStore).forEach((k) => delete mockStore[k]);
        mockReadWriteThrows = false;
        mockConstructorThrows = false;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('answers false before anything is recorded', () => {
        const { hasStartedHabitsCached } = loadCache();

        expect(hasStartedHabitsCached('user-1')).toBe(false);
    });

    it('remembers a start and answers true on the next launch', () => {
        const { rememberHabitsStarted } = loadCache();

        rememberHabitsStarted('user-1');

        // A fresh module registry stands in for a cold start.
        const { hasStartedHabitsCached: readAfterRelaunch } = loadCache();
        expect(readAfterRelaunch('user-1')).toBe(true);
    });

    it('keys per user, so a second account still sees onboarding', () => {
        const { hasStartedHabitsCached, rememberHabitsStarted } = loadCache();

        rememberHabitsStarted('user-1');

        expect(hasStartedHabitsCached('user-1')).toBe(true);
        expect(hasStartedHabitsCached('user-2')).toBe(false);
    });

    it('is a no-op without a user id, rather than writing a shared key', () => {
        const { hasStartedHabitsCached, rememberHabitsStarted } = loadCache();

        rememberHabitsStarted(undefined);

        expect(Object.keys(mockStore)).toHaveLength(0);
        expect(hasStartedHabitsCached(undefined)).toBe(false);
    });

    it('does not rewrite a flag that is already set', () => {
        const { rememberHabitsStarted } = loadCache();

        rememberHabitsStarted('user-1');
        const afterFirst = { ...mockStore };
        rememberHabitsStarted('user-1');

        // Guarding the write is what keeps a re-render storm from turning this
        // into one MMKV write per render.
        expect(mockStore).toEqual(afterFirst);
    });

    it('forgets a single user without touching the others', () => {
        const { hasStartedHabitsCached, rememberHabitsStarted, forgetHabitsStarted } = loadCache();

        rememberHabitsStarted('user-1');
        rememberHabitsStarted('user-2');
        forgetHabitsStarted('user-1');

        expect(hasStartedHabitsCached('user-1')).toBe(false);
        expect(hasStartedHabitsCached('user-2')).toBe(true);
    });

    it('degrades to false when MMKV cannot be constructed', () => {
        mockConstructorThrows = true;
        const { hasStartedHabitsCached, rememberHabitsStarted } = loadCache();

        expect(() => rememberHabitsStarted('user-1')).not.toThrow();
        expect(hasStartedHabitsCached('user-1')).toBe(false);
    });

    it('degrades to false when a read throws', () => {
        const { hasStartedHabitsCached, rememberHabitsStarted } = loadCache();

        rememberHabitsStarted('user-1');
        mockReadWriteThrows = true;

        expect(hasStartedHabitsCached('user-1')).toBe(false);
    });

    it('swallows a failed write, since the only cost is one more flash', () => {
        const { rememberHabitsStarted } = loadCache();
        mockReadWriteThrows = true;

        expect(() => rememberHabitsStarted('user-1')).not.toThrow();
    });
});
