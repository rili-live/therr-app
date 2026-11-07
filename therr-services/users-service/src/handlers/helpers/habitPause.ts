import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../../store';
import enqueueNotification, { EnqueueOutcome } from '../../utilities/enqueueNotification';
import { expandExcusedDates } from '../../utilities/habitCadence';
import {
    getPauseReminderDedupeKey,
    getPauseReminderSchedule,
    groupExcusedRangesByHabit,
    IHabitPauseRow,
    IPauseReminder,
} from '../../utilities/habitPause';

/**
 * Orchestration for pausing a habit. The rules are in utilities/habitPause.ts; the endpoints are
 * in handlers/userHabits.ts.
 */

export interface IQueuePauseRemindersArgs {
    pause: IHabitPauseRow;
    timeZone: string;
    locale: string;
    habitName: string;
}

/**
 * Queue the 7/14/30-day "ready to come back?" pushes for a pause. Each row carries the pause id
 * so the worker can drop it once the pause has ended (utilities/checkinNudgeFreshness.ts) — that,
 * not a delete here, is what cancels them: a resume never has to find and remove queue rows, and a
 * resume that lands while a reminder is mid-send cannot race it into a stale push.
 *
 * Pinned to HABITS: pausing only exists in Friends with Habits, and the brand selects the device
 * token, not just the copy.
 */
export const queuePauseReminders = async ({
    pause,
    timeZone,
    locale,
    habitName,
}: IQueuePauseRemindersArgs): Promise<IPauseReminder[]> => {
    const schedule = getPauseReminderSchedule({
        pausedOn: pause.pausedOn,
        timeZone,
        pausedAt: pause.pausedAt ? new Date(pause.pausedAt) : new Date(),
    });

    const outcomes: EnqueueOutcome[] = await Promise.all(schedule.map((reminder) => enqueueNotification({
        brandVariation: BrandVariations.HABITS,
        toUserId: pause.userId,
        type: PushNotifications.Types.habitPauseReminder,
        dedupeKey: getPauseReminderDedupeKey(pause.id, reminder.dayCount),
        scheduledFor: reminder.scheduledFor,
        payload: {
            locale,
            habitName,
            habitGoalId: pause.habitGoalId,
            habitId: pause.habitGoalId,
            dayCount: reminder.dayCount,
            streakCount: pause.streakAtPause,
            // Read by the send-time freshness check, never by the device.
            pauseId: pause.id,
        },
    })));

    const failed = outcomes.filter((outcome) => outcome === 'failed').length;
    if (failed) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Habit pause: some resume reminders could not be queued'],
            traceArgs: {
                'habitPause.id': pause.id,
                'habitPause.remindersFailed': failed,
                'user.id': pause.userId,
            },
        });
    }

    return schedule;
};

/**
 * End an open pause because the user checked in on the habit today — they are doing it again, so
 * it would be strange to keep calling it paused, and stranger to keep sending "ready to come
 * back?" pushes. Only today's check-in does this: a backdated one fills in a past day and says
 * nothing about whether the user is back.
 *
 * Never throws. A failure leaves the pause open, which costs nothing the user can lose: the
 * check-in still upholds its day, and they can resume by hand.
 */
export const endPauseOnCheckin = async (userId: string, habitGoalId: string, today: string): Promise<IHabitPauseRow | null> => {
    try {
        const result = await Store.habitPauses.close(userId, habitGoalId, today);
        return result ? result.pause : null;
    } catch (err: any) {
        logSpan({
            level: 'warn',
            messageOrigin: 'API_SERVER',
            messages: ['Habit pause: could not end pause on check-in'],
            traceArgs: { 'error.message': err?.message, 'user.id': userId, habitGoalId },
        });
        return null;
    }
};

/**
 * The days in [fromDate, upTo] this habit was paused, for the per-habit streak's gap check.
 *
 * Deliberately not caught. Reading "no pauses" on a failure would count paused days as misses and
 * spend freezes on them, or reset the streak — a loss the user cannot undo. Throwing fails the
 * check-in request instead, and the row's `contributedToStreak` is still false, so the client's
 * retry runs the whole streak path again.
 */
export const loadExcusedDatesForHabit = async (
    userId: string,
    habitGoalId: string,
    fromDate: string,
    upTo: string,
): Promise<Set<string>> => {
    const rows = await Store.habitPauses.getOverlapping(userId, fromDate, upTo, habitGoalId);
    if (!rows.length) {
        return new Set();
    }
    return expandExcusedDates(groupExcusedRangesByHabit(rows).get(habitGoalId), fromDate, upTo);
};
