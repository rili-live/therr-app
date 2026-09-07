import {
    it, describe, expect, jest, beforeEach,
} from '@jest/globals';
import Toast from 'react-native-toast-message';

/**
 * One-tap check-in regression tests.
 *
 * The check-in button used to open `CheckinProofSheet` and wait for a second
 * confirm tap before anything was written. Nothing in that sheet was ever
 * required — `onConfirm` accepts an empty note and no photo — so it was pure
 * friction on the single action the product depends on, and Duolingo's
 * published result for removing exactly this kind of barrier was +3.3% D14
 * retention and +10.5% daily learners holding a streak.
 *
 * The button now commits on the first tap and the sheet is offered afterwards
 * from the success toast. These tests lock in both halves: that the first tap
 * writes, and that the follow-up "add a note or photo" path does not re-offer
 * itself in a loop.
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
    request: jest.fn(() => Promise.resolve('granted')),
    PERMISSIONS: { IOS: {}, ANDROID: {} },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
}));

// Imported after the mocks above deliberately — the screen pulls in a chain of
// native modules at import time.
import { HabitsDashboard } from '../../main/routes/Habits/Dashboard';

// The toast types registered in App.tsx's `toastConfig`. A `Toast.show` with a
// type outside this set renders nothing at all.
const REGISTERED_TOAST_TYPES = [
    'info', 'success', 'successBig', 'warn', 'warnBig', 'notifyPublic', 'error', 'errorBig',
];

const HABIT: any = { id: 'goal-1', name: 'Morning run' };

const flushPromises = () => new Promise<void>((resolve) => { setImmediate(resolve); });

const buildInstance = ({ shouldReject = false } = {}) => {
    const createCheckin = jest.fn(() => (shouldReject
        ? Promise.reject(new Error('network'))
        : Promise.resolve({ id: 'checkin-1' }))) as any;
    const getActiveStreaks = jest.fn(() => Promise.resolve([])) as any;

    const props: any = {
        user: { settings: {}, details: { id: 'me' } },
        habits: {
            habitGoals: [HABIT], todayCheckins: [], streaks: [], pacts: [], activePacts: [], pendingInvites: [],
        },
        navigation: { navigate: jest.fn(), addListener: jest.fn() },
        route: { params: {} },
        createCheckin,
        getActiveStreaks,
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
    const setState = jest.fn((partial: any) => {
        instance.state = { ...instance.state, ...partial };
    }) as any;
    instance.setState = setState;
    instance.handleRefresh = jest.fn() as any;

    return { instance, createCheckin, getActiveStreaks, setState };
};

describe('habits dashboard one-tap check-in', () => {
    beforeEach(() => {
        (Toast.show as any).mockClear();
        (Toast.hide as any).mockClear();
    });

    it('writes the check-in on the first tap instead of opening the proof sheet', async () => {
        const { instance, createCheckin, setState } = buildInstance();

        instance.handleCheckin(HABIT);
        await flushPromises();

        expect(createCheckin).toHaveBeenCalledTimes(1);
        const body: any = createCheckin.mock.calls[0][0];
        expect(body.habitGoalId).toBe('goal-1');
        expect(body.status).toBe('completed');
        // The whole point: nothing was collected before writing.
        expect(body.notes).toBeUndefined();
        expect(body.proofMedias).toBeUndefined();

        // The sheet must not have been opened as a prerequisite.
        const openedSheetBeforeWriting = setState.mock.calls
            .some(([partial]: any) => partial && partial.proofSheetHabit === HABIT);
        expect(openedSheetBeforeWriting).toBe(false);
    });

    it('keys the write to the UTC calendar day the users-service counts habits in', async () => {
        const { instance, createCheckin } = buildInstance();

        instance.handleCheckin(HABIT);
        await flushPromises();

        const body: any = createCheckin.mock.calls[0][0];
        expect(body.scheduledDate).toBe(new Date().toISOString().split('T')[0]);
    });

    it('confirms with an actionable toast that opens the proof sheet', async () => {
        const { instance, setState } = buildInstance();

        instance.handleCheckin(HABIT);
        await flushPromises();

        const call: any = (Toast.show as any).mock.calls[0][0];
        expect(REGISTERED_TOAST_TYPES).toContain(call.type);
        expect(call.text1).toContain('Morning run');
        // Nothing about the toast styling signals it is tappable, so the copy
        // has to say so — it is the only route to the proof sheet now.
        expect(call.text2).toMatch(/tap/i);
        expect(typeof call.onPress).toBe('function');

        setState.mockClear();
        call.onPress();

        expect(Toast.hide).toHaveBeenCalled();
        expect(setState).toHaveBeenCalledWith({ proofSheetHabit: HABIT });
    });

    it('refreshes streaks so the tap visibly moves the number it was made for', async () => {
        const { instance, getActiveStreaks } = buildInstance();

        instance.handleCheckin(HABIT);
        await flushPromises();

        expect(getActiveStreaks).toHaveBeenCalled();
    });

    it('does not re-offer the proof sheet after a note or photo was added', async () => {
        const { instance, createCheckin } = buildInstance();
        instance.state = { ...instance.state, proofSheetHabit: HABIT };

        instance.handleProofSheetConfirm({ notes: 'felt good' });
        await flushPromises();

        expect(createCheckin).toHaveBeenCalledTimes(1);
        expect(createCheckin.mock.calls[0][0].notes).toBe('felt good');

        const call: any = (Toast.show as any).mock.calls[0][0];
        expect(REGISTERED_TOAST_TYPES).toContain(call.type);
        expect(call.onPress).toBeUndefined();
    });

    it('surfaces an error and offers nothing when the write fails', async () => {
        const { instance } = buildInstance({ shouldReject: true });

        instance.handleCheckin(HABIT);
        await flushPromises();

        expect((Toast.show as any).mock.calls).toHaveLength(1);
        const call: any = (Toast.show as any).mock.calls[0][0];
        expect(call.type).toMatch(/^error/);
        expect(call.onPress).toBeUndefined();
    });
});
