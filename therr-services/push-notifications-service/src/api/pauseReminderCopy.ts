/**
 * Copy selection for `habitPauseReminder` — the "ready to pick it back up?" push queued when a
 * user pauses a habit (users-service `handlers/helpers/habitPause.ts`).
 *
 * Three sends per pause, at 7, 14 and 30 days. Each has its own copy because they say different
 * things: the first is a light check-in, the second a nudge, and the third has to say plainly that
 * it is the last one, since the user was told at pause time that the reminders stop after a month.
 *
 * `dayCount` is the reminder's offset from the pause, not a count the user built up. Anything that
 * is not one of the three known offsets falls back to the first stage rather than to a raw key:
 * a wrong-but-friendly reminder beats a key path rendered into the tray.
 */

export const PAUSE_REMINDER_STAGES = ['week', 'twoWeeks', 'final'] as const;

export type PauseReminderStage = typeof PAUSE_REMINDER_STAGES[number];

export const getPauseReminderStage = (dayCount: unknown): PauseReminderStage => {
    const days = Number(dayCount);
    if (days >= 30) {
        return 'final';
    }
    if (days >= 14) {
        return 'twoWeeks';
    }
    return 'week';
};

/**
 * Only promises to keep a streak there is one to keep — a habit paused at 0 days would otherwise
 * be told its "0-day streak" is safe.
 */
export const selectPauseReminderCopyKeys = (dayCount: unknown, streakCount: unknown): { titleKey: string; bodyKey: string } => {
    const stage = getPauseReminderStage(dayCount);
    const hasStreak = Number(streakCount) > 0;
    return {
        titleKey: `notifications.habitPauseReminder.${stage}.title`,
        bodyKey: `notifications.habitPauseReminder.${stage}.${hasStreak ? 'bodyWithStreak' : 'body'}`,
    };
};
