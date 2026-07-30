import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';
import Toast from 'react-native-toast-message';

/**
 * PactsList nudge-outcome regression tests.
 *
 * The users-service `nudgePact` handler answers **200** even when no nudge
 * actually went out: the 7-day per-partner cooldown and per-partner dispatch
 * failures are reported inside the `nudgeResults` array on the response body,
 * never as an HTTP error status.
 *
 * A prior version of `handleNudge` branched only on promise settlement, so it
 * showed "Nudge sent! Your partner will be reminded." whenever the request
 * succeeded — including when every partner was still in cooldown and nothing
 * was dispatched. Its `.catch()` branch compounded this by showing the
 * *cooldown* copy for genuine failures, under the toast type `errorToast`,
 * which is not registered in `App.tsx`'s `toastConfig` and therefore rendered
 * nothing at all.
 *
 * These tests drive the real `handleNudge` on the exported class and lock in
 * the outcome-aware toast selection.
 */

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn() },
}));

// Reaches for permissions/native modules at import time.
jest.mock('../../main/utilities/permissionsOrchestrator', () => ({
    __esModule: true,
    default: { requestIfAppropriate: jest.fn() },
}));

// Pulled in transitively via MainButtonMenu -> constants; throws under Jest
// because it resolves its native module at import time.
jest.mock('@notifee/react-native', () => ({
    __esModule: true,
    default: {},
    AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2 },
    AndroidChannel: {},
}));

// Pulled in transitively via components/Habits -> CheckinProofSheet; resolves
// its native module at import time.
jest.mock('react-native-image-crop-picker', () => ({
    __esModule: true,
    default: { openPicker: jest.fn(), openCamera: jest.fn() },
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
    request: jest.fn(() => Promise.resolve('granted')),
    PERMISSIONS: { IOS: {}, ANDROID: {} },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
}));

// Imported after the mocks above deliberately: PactsList pulls in a chain of
// native modules at import time, and jest.mock factories must be registered
// before that chain is required.
import { PactsList } from '../../main/routes/Pacts/PactsList';

// The toast types registered in App.tsx's `toastConfig`. A `Toast.show` with a
// type outside this set renders nothing, so asserting membership is what
// actually catches the `errorToast` class of bug.
const REGISTERED_TOAST_TYPES = [
    'info', 'success', 'successBig', 'warn', 'warnBig', 'notifyPublic', 'error', 'errorBig',
];

const PACT: any = { id: 'pact-1' };

// `handleNudge` is an event handler and does not return its promise chain, so
// drain the microtask queue before asserting on the toast it fired.
const flushPromises = () => new Promise<void>((resolve) => { setImmediate(resolve); });

const buildInstance = (nudgeResponse: any, shouldReject = false) => {
    const nudgePact = jest.fn(() => (shouldReject
        ? Promise.reject(new Error('network'))
        : Promise.resolve(nudgeResponse))) as any;

    const props: any = {
        user: { settings: {}, details: { id: 'me' } },
        habits: { pacts: [], activePacts: [], pendingInvites: [] },
        navigation: { navigate: jest.fn(), addListener: jest.fn() },
        route: { params: {} },
        nudgePact,
        acceptPact: jest.fn(),
        declinePact: jest.fn(),
        getUserPacts: jest.fn(),
        getActivePacts: jest.fn(),
        getPendingInvites: jest.fn(),
    };

    const instance = new PactsList(props);
    instance.setState = jest.fn();
    instance.handleRefresh = jest.fn();

    return { instance, nudgePact };
};

describe('PactsList nudge outcome toasts', () => {
    beforeEach(() => {
        (Toast.show as any).mockClear();
    });

    it('reports success when at least one partner was actually nudged', async () => {
        const { instance } = buildInstance({
            id: 'pact-1',
            nudgeResults: [{ partnerId: 'p1', nudged: true }],
        });

        instance.handleNudge(PACT);
        await flushPromises();

        const call: any = (Toast.show as any).mock.calls[0][0];
        expect(call.type).toBe('success');
        expect(call.text1).toMatch(/nudgeSuccess|Nudge sent/i);
    });

    it('does NOT claim success when every partner is still in cooldown', async () => {
        const { instance } = buildInstance({
            id: 'pact-1',
            nudgeResults: [{
                partnerId: 'p1',
                nudged: false,
                reason: 'cooldown',
                nextNudgeAvailableAt: new Date().toISOString(),
            }],
        });

        instance.handleNudge(PACT);
        await flushPromises();

        const call: any = (Toast.show as any).mock.calls[0][0];
        expect(call.type).not.toBe('success');
        expect(call.text1).toMatch(/nudgeCooldown|already sent/i);
    });

    it('reports an error — not a cooldown — when every partner dispatch failed', async () => {
        const { instance } = buildInstance({
            id: 'pact-1',
            nudgeResults: [{ partnerId: 'p1', nudged: false, reason: 'error' }],
        });

        instance.handleNudge(PACT);
        await flushPromises();

        const call: any = (Toast.show as any).mock.calls[0][0];
        expect(call.type).toBe('error');
        expect(call.text1).not.toMatch(/nudgeCooldown|already sent/i);
    });

    it('surfaces a renderable error toast when the request itself rejects', async () => {
        const { instance } = buildInstance(null, true);

        instance.handleNudge(PACT);
        await flushPromises();

        const call: any = (Toast.show as any).mock.calls[0][0];
        // The pre-fix code used `errorToast`, which is absent from toastConfig,
        // so the user saw nothing when a nudge failed.
        expect(REGISTERED_TOAST_TYPES).toContain(call.type);
        expect(call.text1).not.toMatch(/nudgeCooldown|already sent/i);
    });

    it('only ever shows toast types registered in App.tsx toastConfig', async () => {
        const cases = [
            { nudgeResults: [{ partnerId: 'p1', nudged: true }] },
            { nudgeResults: [{ partnerId: 'p1', nudged: false, reason: 'cooldown' }] },
            { nudgeResults: [{ partnerId: 'p1', nudged: false, reason: 'error' }] },
        ];


        for (const response of cases) {
            const { instance } = buildInstance(response);
            instance.handleNudge(PACT);

            await flushPromises();
        }

        (Toast.show as any).mock.calls.forEach(([call]: any[]) => {
            expect(REGISTERED_TOAST_TYPES).toContain(call.type);
        });
    });
});
