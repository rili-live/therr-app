import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';
import Toast from 'react-native-toast-message';

/**
 * How the habits dashboard reacts when the server refuses an action.
 *
 * The app's response interceptor (`main/interceptors.ts`) rejects with the
 * response *body* — whose `statusCode` echoes the HTTP status — not the axios
 * error, so `err.response` is always undefined in a screen. The "continue solo"
 * handler read `err.response.data`, which meant the solo-lock explanation never
 * showed and every lock looked like a failure. The errors below are built in the
 * shape the interceptor actually produces.
 */

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn(), hide: jest.fn() },
}));

jest.mock('../../main/utilities/permissionsOrchestrator', () => ({
    __esModule: true,
    default: { requestIfAppropriate: jest.fn() },
}));

// Pulled in transitively via constants; resolves its native module at import time.
jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: {},
    AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2 },
    AndroidChannel: {},
}));

jest.mock('react-native-image-crop-picker', () => ({
    __esModule: true,
    default: { openPicker: jest.fn(), openCamera: jest.fn() },
}));

jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn(), wrap: jest.fn() },
}));

jest.mock('@react-native-firebase/analytics', () => ({
    __esModule: true,
    getAnalytics: jest.fn(() => ({})),
    logEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-permissions', () => ({
    __esModule: true,
    requestMultiple: jest.fn(() => Promise.resolve({})),
    checkMultiple: jest.fn(() => Promise.resolve({})),
    check: jest.fn(() => Promise.resolve('granted')),
    PERMISSIONS: { IOS: {}, ANDROID: {} },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
}));

// Pinned rather than read from env-config, which resolves flags per brand: the
// paywall route only exists with the lifetime offer switched on.
jest.mock('../../main/utilities/getConfig', () => {
    const actual: any = jest.requireActual('../../main/utilities/getConfig');
    const getActualConfig = actual.default || actual;
    return {
        __esModule: true,
        default: () => {
            const config = getActualConfig();
            return {
                ...config,
                featureFlags: { ...config.featureFlags, ENABLE_HABITS_LIFETIME_OFFER: true },
            };
        },
    };
});

// Imported after the mocks above deliberately — the screen pulls in a chain of
// native modules at import time.
import { HabitsDashboard } from '../../main/routes/Habits/Dashboard';
import celebrationQueue from '../../main/utilities/celebrationQueue';

const HABIT: any = { id: 'goal-1', name: 'Morning run' };

const flushPromises = () => new Promise<void>((resolve) => { setImmediate(resolve); });

const buildInstance = ({ checkinError, continueSoloError }: { checkinError?: any; continueSoloError?: any }) => {
    const props: any = {
        user: { settings: {}, details: { id: 'me' } },
        habits: {
            habitGoals: [HABIT], todayCheckins: [], streaks: [], pacts: [], activePacts: [], pendingInvites: [],
        },
        navigation: { navigate: jest.fn(), addListener: jest.fn() },
        route: { params: {} },
        createCheckin: jest.fn(() => Promise.reject(checkinError)),
        continueSoloUserHabit: jest.fn(() => Promise.reject(continueSoloError)),
        getActiveStreaks: jest.fn(() => Promise.resolve([])),
        getUserGoals: jest.fn(),
        getTodayCheckins: jest.fn(),
        getActivePacts: jest.fn(),
        getUserPacts: jest.fn(),
        getPendingInvites: jest.fn(),
        getUserHabitEligibility: jest.fn(),
        acceptPact: jest.fn(),
        declinePact: jest.fn(),
        nudgePact: jest.fn(),
    };

    const instance = new HabitsDashboard(props);
    instance.setState = jest.fn((partial: any) => {
        instance.state = { ...instance.state, ...partial };
    }) as any;
    instance.handleRefresh = jest.fn() as any;

    return { instance, props };
};

describe('habits dashboard — server refusals', () => {
    beforeEach(() => {
        (Toast.show as any).mockClear();
        celebrationQueue.reset();
    });

    it('routes a check-in refused at the habit cap to the paywall', async () => {
        const { instance, props } = buildInstance({
            checkinError: {
                statusCode: 402,
                message: 'Free accounts can track 5 habits at a time.',
                error: 'habit-limit-reached',
                limit: 5,
                upgradeRequired: true,
            },
        });

        instance.handleCheckin(HABIT);
        await flushPromises();

        expect(props.navigation.navigate).toHaveBeenCalledWith('UpgradePaywall', {
            reason: 'habit-limit-reached',
            limit: 5,
        });
        expect(Toast.show).not.toHaveBeenCalled();
    });

    it('still reports any other check-in failure as an error', async () => {
        const { instance, props } = buildInstance({
            checkinError: { statusCode: 500, message: 'SQL:HABIT_CHECKINS_ROUTES:ERROR' },
        });

        instance.handleCheckin(HABIT);
        await flushPromises();

        expect(props.navigation.navigate).not.toHaveBeenCalledWith('UpgradePaywall', expect.anything());
        expect((Toast.show as any).mock.calls).toHaveLength(1);
        expect(((Toast.show as any).mock.calls[0][0] as any).type).toMatch(/^error/);
    });

    it('explains a solo lock on "continue solo" instead of reporting a failure', async () => {
        const { instance } = buildInstance({
            continueSoloError: {
                statusCode: 403,
                error: 'solo-locked',
                invitedCount: 1,
                requiredCount: 3,
            },
        });

        instance.handleContinueSolo({ userHabit: { id: 'uh-1' }, goal: HABIT } as any);
        await flushPromises();

        expect((Toast.show as any).mock.calls).toHaveLength(1);
        expect(((Toast.show as any).mock.calls[0][0] as any).type).toBe('info');
    });
});
