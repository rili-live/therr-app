import 'react-native';
import {
    it, describe, expect, jest,
} from '@jest/globals';

/**
 * Saving a new cadence from the habit detail screen's editor sheet.
 *
 * A failed save must leave the sheet open on the user's draft. The editor used to close in
 * `finally`, so a network blip threw away the schedule the user had just picked and they had
 * to rebuild it from scratch to retry.
 */

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn(), hide: jest.fn() },
}));

jest.mock('../../main/utilities/toasts', () => ({
    __esModule: true,
    DURATION: {},
    showToast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
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
import { HabitDetail } from '../../main/routes/Habits/HabitDetail';
import { showToast } from '../../main/utilities/toasts';

const flushPromises = () => new Promise<void>((resolve) => { setImmediate(resolve); });

const goal = {
    id: 'goal-1',
    name: 'Run',
    createdByUserId: 'me',
    isTemplate: false,
    frequencyType: 'daily',
    frequencyCount: 1,
    targetDaysOfWeek: [],
};

const buildInstance = (updateGoal: any) => {
    const props: any = {
        user: { settings: { locale: 'en-us' }, details: { id: 'me' } },
        habits: { habitGoals: [goal], userHabits: [] },
        navigation: { navigate: jest.fn(), setOptions: jest.fn(), goBack: jest.fn() },
        route: { params: { habitGoalId: 'goal-1' } },
        updateGoal,
        getUserHabits: jest.fn(() => Promise.resolve()),
    };

    const instance = new HabitDetail(props);
    instance.setState = jest.fn((partial: any) => {
        instance.state = { ...instance.state, ...partial };
    }) as any;

    return instance;
};

const fourTimesAWeek = { kind: 'weeklyCount' as const, count: 4 };

describe('habit detail cadence save', () => {
    it('keeps the editor open on the user\'s draft when the save fails', async () => {
        const instance = buildInstance(jest.fn(() => Promise.reject(new Error('offline'))));
        instance.handleEditCadencePress();
        instance.handleDraftCadenceChange(fourTimesAWeek);

        instance.handleSaveCadence();
        await flushPromises();

        expect(showToast.error).toHaveBeenCalled();
        expect(instance.state.draftCadence).toEqual(fourTimesAWeek);
        expect(instance.state.isSavingCadence).toBe(false);
    });

    it('closes the editor once the save succeeds', async () => {
        const updateGoal = jest.fn(() => Promise.resolve({}));
        const instance = buildInstance(updateGoal);
        instance.handleEditCadencePress();
        instance.handleDraftCadenceChange(fourTimesAWeek);

        instance.handleSaveCadence();
        await flushPromises();

        expect(updateGoal).toHaveBeenCalledWith('goal-1', expect.objectContaining({ frequencyType: 'weekly', frequencyCount: 4 }));
        expect(showToast.success).toHaveBeenCalled();
        expect(instance.state.draftCadence).toBeNull();
        expect(instance.state.isSavingCadence).toBe(false);
    });
});
