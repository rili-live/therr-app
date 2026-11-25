import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordPositiveSignal } from './appReviewPrompt';
import { toLocalDateKey } from './localDateKey';
import permissions from './permissionsOrchestrator';

/**
 * What a completed habit check-in feeds into besides the check-in itself.
 *
 * Every screen that completes a check-in (dashboard, habit detail, the note/photo screen, the
 * first-session screen, the push quick-action) calls `onHabitCheckinCompleted`, so both rules
 * below see every check-in however the user made it:
 *
 * - **Review prompt.** One `habitCheckinDay` signal per local day (`utilities/appReviewPrompt`).
 *   Three check-in days make a habits user askable for a review. Before this, habits check-ins
 *   counted for nothing there.
 * - **Notification re-ask.** On the third distinct check-in day, someone who declined
 *   notifications gets the one second ask `permissions.requestOnceMoreIfDeclined` allows. By
 *   then they have a streak worth protecting, which is the case the primer makes.
 *
 * Fire-and-forget: nothing here may delay or fail the check-in that triggered it.
 */

export const CHECKIN_DAYS_STORAGE_KEY = 'habitCheckinDaysState';

/** Distinct check-in days before a user who declined notifications is asked once more. */
export const STREAK_PROTECT_MIN_CHECKIN_DAYS = 3;

export interface ICheckinDaysState {
    lastDayKey: string;
    dayCount: number;
}

const isValidState = (parsed: any): parsed is ICheckinDaysState => !!parsed
    && typeof parsed.lastDayKey === 'string'
    && typeof parsed.dayCount === 'number';

/**
 * Counts distinct local days with a completed check-in on this install. A second check-in on
 * the same day returns `isNewDay: false` and leaves the count alone.
 */
export const recordCheckinDay = async (dayKey: string): Promise<{ dayCount: number; isNewDay: boolean }> => {
    let existing: ICheckinDaysState | undefined;
    try {
        const raw = await AsyncStorage.getItem(CHECKIN_DAYS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : undefined;
        existing = isValidState(parsed) ? parsed : undefined;
    } catch {
        existing = undefined;
    }

    if (existing && existing.lastDayKey === dayKey) {
        return { dayCount: existing.dayCount, isNewDay: false };
    }

    const next: ICheckinDaysState = { lastDayKey: dayKey, dayCount: (existing?.dayCount || 0) + 1 };
    try {
        await AsyncStorage.setItem(CHECKIN_DAYS_STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Best effort. A lost write delays the re-ask by a day at most.
    }

    return { dayCount: next.dayCount, isNewDay: true };
};

export interface IHabitCheckinCompletedOptions {
    /** The check-in's local day. Defaults to today. */
    dayKey?: string;
    /**
     * False where the caller asks for notifications itself (the first-session screen) or the
     * user cannot be holding a declined permission (a push quick-action).
     */
    mayAskForNotifications?: boolean;
}

export const onHabitCheckinCompleted = ({
    dayKey = toLocalDateKey(new Date()),
    mayAskForNotifications = true,
}: IHabitCheckinCompletedOptions = {}): Promise<void> => {
    recordPositiveSignal('habitCheckinDay', Date.now(), { dayKey })
        .catch((err) => console.log('APP_REVIEW_SIGNAL_ERROR', err));

    return recordCheckinDay(dayKey)
        .then(({ dayCount, isNewDay }) => {
            if (!mayAskForNotifications || !isNewDay || dayCount < STREAK_PROTECT_MIN_CHECKIN_DAYS) {
                return;
            }

            return permissions.requestOnceMoreIfDeclined('notifications', { trigger: 'streakProtect' });
        })
        .catch((err) => console.log('HABIT_CHECKIN_MOMENTS_ERROR', err));
};

export default onHabitCheckinCompleted;
