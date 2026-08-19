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

const buildInstance = (nudgeResponse: any, shouldReject = false, rejectionValue: any = new Error('network')) => {
    const nudgePact = jest.fn(() => (shouldReject
        ? Promise.reject(rejectionValue)
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
        expect(call.text1).toMatch(/nudgeCooldown|already (sent|nudged)/i);
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
        expect(call.text1).not.toMatch(/nudgeCooldown|already (sent|nudged)/i);
    });

    // "Could not send the nudge. Please try again." is wrong advice for a partner with no
    // Habits install and no email or phone on file — retrying can never work.
    it('tells the user to share a link when the partner is unreachable', async () => {
        const { instance } = buildInstance({
            id: 'pact-1',
            nudgeResults: [{ partnerId: 'p1', nudged: false, reason: 'undeliverable' }],
        });

        instance.handleNudge(PACT);
        await flushPromises();

        const call: any = (Toast.show as any).mock.calls[0][0];
        expect(call.type).toBe('error');
        expect(call.text1).toMatch(/no way to reach/i);
        expect(call.text1).not.toMatch(/try again/i);
    });

    it('names the date the cooldown lifts when the server reports one', async () => {
        const { instance } = buildInstance({
            id: 'pact-1',
            nudgeResults: [{
                partnerId: 'p1',
                nudged: false,
                reason: 'cooldown',
                nextNudgeAvailableAt: '2026-09-02T00:00:00.000Z',
            }],
        });

        instance.handleNudge(PACT);
        await flushPromises();

        const call: any = (Toast.show as any).mock.calls[0][0];
        expect(call.type).toBe('warn');
        expect(call.text1).toMatch(/Sep 2|Sep 1/); // rendered in the device's timezone
        expect(call.text1).not.toMatch(/\{date\}/);
    });

    it('reports the earliest date when several partners are in cooldown', async () => {
        const { instance } = buildInstance({
            id: 'pact-1',
            nudgeResults: [
                { partnerId: 'p1', nudged: false, reason: 'cooldown', nextNudgeAvailableAt: '2026-09-20T00:00:00.000Z' },
                { partnerId: 'p2', nudged: false, reason: 'cooldown', nextNudgeAvailableAt: '2026-09-02T00:00:00.000Z' },
            ],
        });

        instance.handleNudge(PACT);
        await flushPromises();

        const call: any = (Toast.show as any).mock.calls[0][0];
        expect(call.text1).toMatch(/Sep 2|Sep 1/);
        expect(call.text1).not.toMatch(/Sep 20|Sep 19/);
    });

    it('does not claim a clean success when only some partners were nudged', async () => {
        const { instance } = buildInstance({
            id: 'pact-1',
            nudgeResults: [
                { partnerId: 'p1', nudged: true },
                { partnerId: 'p2', nudged: false, reason: 'undeliverable' },
            ],
        });

        instance.handleNudge(PACT);
        await flushPromises();

        const call: any = (Toast.show as any).mock.calls[0][0];
        expect(call.type).not.toBe('success');
        expect(call.text1).toMatch(/1 of 2/);
    });

    it('surfaces a renderable error toast when the request itself rejects', async () => {
        const { instance } = buildInstance(null, true);

        instance.handleNudge(PACT);
        await flushPromises();

        const call: any = (Toast.show as any).mock.calls[0][0];
        // The pre-fix code used `errorToast`, which is absent from toastConfig,
        // so the user saw nothing when a nudge failed.
        expect(REGISTERED_TOAST_TYPES).toContain(call.type);
        expect(call.text1).not.toMatch(/nudgeCooldown|already (sent|nudged)/i);
    });

    // A rejection that never reached the API has no statusCode; `error.message` there is
    // axios's "Network Error", which is not copy to put in front of a user.
    it('reports a connection problem when the request never reached the API', async () => {
        const { instance } = buildInstance(null, true);

        instance.handleNudge(PACT);
        await flushPromises();

        const call: any = (Toast.show as any).mock.calls[0][0];
        expect(call.text2).toMatch(/could not reach the server/i);
        expect(call.text2).not.toMatch(/^network$/i);
    });

    // The API's error bodies are localized and name the actual reason, and the axios
    // interceptor rejects with that body verbatim. Replacing it with this screen's generic
    // copy is what made "send nudge" failures unactionable.
    it('shows the API\'s own reason when the server rejected the nudge', async () => {
        const apiError: any = {
            statusCode: 403,
            errorCode: 'NotPermitted',
            message: 'Only the person who created this pact can send a nudge',
        };
        const { instance } = buildInstance(null, true, apiError);

        instance.handleNudge(PACT);
        await flushPromises();

        const call: any = (Toast.show as any).mock.calls[0][0];
        expect(call.type).toBe('error');
        expect(call.text2).toBe('Only the person who created this pact can send a nudge');
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
