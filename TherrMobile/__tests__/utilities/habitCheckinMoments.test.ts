// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, beforeEach, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * `onHabitCheckinCompleted` runs after every completed check-in. What it must get right: the
 * notification re-ask fires on the third distinct check-in day (not the third check-in), never
 * where the caller opted out, and nothing it does can reject into the check-in flow.
 */

const mockRequestOnceMoreIfDeclined = jest.fn();
const mockRecordPositiveSignal = jest.fn();

jest.mock('../../main/utilities/permissionsOrchestrator', () => ({
    __esModule: true,
    default: { requestOnceMoreIfDeclined: (...args: any[]) => mockRequestOnceMoreIfDeclined(...args) },
}));

jest.mock('../../main/utilities/appReviewPrompt', () => ({
    recordPositiveSignal: (...args: any[]) => mockRecordPositiveSignal(...args),
}));

import {
    CHECKIN_DAYS_STORAGE_KEY,
    STREAK_PROTECT_MIN_CHECKIN_DAYS,
    onHabitCheckinCompleted,
    recordCheckinDay,
} from '../../main/utilities/habitCheckinMoments';

const dayKeys = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'];

describe('habit check-in moments', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        mockRequestOnceMoreIfDeclined.mockResolvedValue(undefined as never);
        mockRecordPositiveSignal.mockResolvedValue(undefined as never);
        await AsyncStorage.removeItem(CHECKIN_DAYS_STORAGE_KEY);
    });

    it('counts distinct days, not check-ins', async () => {
        expect(await recordCheckinDay(dayKeys[0])).toEqual({ dayCount: 1, isNewDay: true });
        expect(await recordCheckinDay(dayKeys[0])).toEqual({ dayCount: 1, isNewDay: false });
        expect(await recordCheckinDay(dayKeys[1])).toEqual({ dayCount: 2, isNewDay: true });
    });

    it('asks for notifications once the third check-in day arrives', async () => {
        for (let i = 0; i < STREAK_PROTECT_MIN_CHECKIN_DAYS - 1; i += 1) {
            await onHabitCheckinCompleted({ dayKey: dayKeys[i] });
        }
        expect(mockRequestOnceMoreIfDeclined).not.toHaveBeenCalled();

        await onHabitCheckinCompleted({ dayKey: dayKeys[STREAK_PROTECT_MIN_CHECKIN_DAYS - 1] });
        expect(mockRequestOnceMoreIfDeclined).toHaveBeenCalledWith('notifications', { trigger: 'streakProtect' });
    });

    it('does not ask again for a second check-in on the same day', async () => {
        for (let i = 0; i < STREAK_PROTECT_MIN_CHECKIN_DAYS; i += 1) {
            await onHabitCheckinCompleted({ dayKey: dayKeys[i] });
        }
        await onHabitCheckinCompleted({ dayKey: dayKeys[STREAK_PROTECT_MIN_CHECKIN_DAYS - 1] });

        expect(mockRequestOnceMoreIfDeclined).toHaveBeenCalledTimes(1);
    });

    it('never asks where the caller opted out, but still counts the day', async () => {
        for (let i = 0; i < STREAK_PROTECT_MIN_CHECKIN_DAYS; i += 1) {
            await onHabitCheckinCompleted({ dayKey: dayKeys[i], mayAskForNotifications: false });
        }

        expect(mockRequestOnceMoreIfDeclined).not.toHaveBeenCalled();
        expect(await recordCheckinDay(dayKeys[3])).toEqual({ dayCount: 4, isNewDay: true });
    });

    it('records a once-per-day review signal for the check-in day', async () => {
        await onHabitCheckinCompleted({ dayKey: dayKeys[0] });

        expect(mockRecordPositiveSignal).toHaveBeenCalledWith('habitCheckinDay', expect.any(Number), { dayKey: dayKeys[0] });
    });

    it('swallows failures so the check-in flow never sees them', async () => {
        mockRecordPositiveSignal.mockRejectedValue(new Error('storage') as never);
        mockRequestOnceMoreIfDeclined.mockRejectedValue(new Error('primer') as never);

        for (let i = 0; i < STREAK_PROTECT_MIN_CHECKIN_DAYS; i += 1) {
            await expect(onHabitCheckinCompleted({ dayKey: dayKeys[i] })).resolves.toBeUndefined();
        }
    });
});
