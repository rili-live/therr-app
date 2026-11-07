import { IUserHabit, IUserHabitPause } from 'therr-react/types';

/**
 * Client-side reading of a habit's pause state. The rules — what a pause excuses, when the
 * reminders go out, the re-pause cooldown — are the server's (users-service
 * `utilities/habitPause.ts`); this only turns what the server sent into what the screen says.
 *
 * Kept free of react-native imports so it is unit-testable without the native module graph.
 */

/** Days after the pause the "ready to come back?" reminders go out. Mirrors the server. */
export const PAUSE_REMINDER_DAYS = [7, 14, 30];

/** Days after a pause ends before the habit can be paused again. Mirrors the server. */
export const PAUSE_COOLDOWN_DAYS = 7;

/**
 * A server local day ('YYYY-MM-DD') as a Date at local midnight. `new Date('2026-11-07')` parses as
 * UTC midnight, which is the previous evening anywhere west of Greenwich — the paused-since date
 * would read a day early for every American user.
 */
export const localDayToDate = (day?: string | null): Date | null => {
    if (!day || !/^\d{4}-\d{2}-\d{2}/.test(day)) {
        return null;
    }
    const [year, month, date] = day.slice(0, 10).split('-').map((part) => parseInt(part, 10));
    const result = new Date(year, month - 1, date);
    return Number.isNaN(result.getTime()) ? null : result;
};

/** `days` after a local day, as a Date at local midnight. */
export const addDaysToLocalDay = (day: string, days: number): Date | null => {
    const start = localDayToDate(day);
    if (!start) {
        return null;
    }
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + days);
};

/** The open pause on a habit, or null. An older server sends no `pause` at all. */
export const getOpenPause = (userHabit?: Pick<IUserHabit, 'pause'> | null): IUserHabitPause | null => {
    const pause = userHabit?.pause;
    return pause && pause.id && pause.pausedOn ? pause : null;
};

/**
 * When the next "ready to come back?" reminder lands, or null once all three have gone. Reads the
 * server's `upcomingReminderDays` when present, falling back to the fixed schedule against
 * `daysPaused`.
 */
export const getNextPauseReminderDate = (pause: IUserHabitPause): Date | null => {
    const upcoming = Array.isArray(pause.upcomingReminderDays)
        ? pause.upcomingReminderDays
        : PAUSE_REMINDER_DAYS.filter((day) => day > (Number(pause.daysPaused) || 0));
    if (!upcoming.length) {
        return null;
    }
    return addDaysToLocalDay(pause.pausedOn, Math.min(...upcoming));
};

/** The date of the first reminder for a pause starting today — what the success toast names. */
export const getFirstPauseReminderDate = (reminders?: { dayCount: number; localDate: string }[]): Date | null => {
    if (!Array.isArray(reminders) || !reminders.length) {
        return null;
    }
    const first = [...reminders].sort((a, b) => a.dayCount - b.dayCount)[0];
    return localDayToDate(first.localDate);
};

/**
 * What the pause section offers right now:
 *   - `paused`   the habit is paused — show the banner and Resume.
 *   - `cooldown` a pause ended recently — explain when it can be paused again.
 *   - `available` show the Pause button.
 */
export type PauseAvailability =
    | { kind: 'paused'; pause: IUserHabitPause }
    | { kind: 'cooldown'; availableOn: Date }
    | { kind: 'available' };

export const getPauseAvailability = (
    userHabit?: Pick<IUserHabit, 'pause' | 'pauseAvailableOn' | 'status'> | null,
): PauseAvailability | null => {
    if (!userHabit || userHabit.status !== 'active') {
        return null;
    }
    const pause = getOpenPause(userHabit);
    if (pause) {
        return { kind: 'paused', pause };
    }
    const availableOn = localDayToDate(userHabit.pauseAvailableOn);
    if (availableOn) {
        return { kind: 'cooldown', availableOn };
    }
    return { kind: 'available' };
};

/**
 * Set when a streak nudge offered "Pause" (its streak has no freezes left). `open` comes from the
 * notification's Pause button and opens the pause dialog on arrival; `suggest` comes from a tap on
 * the notification body and shows a pause prompt beside the check-in. After the dialog opens once,
 * `open` is rewritten to `suggest` so it does not reopen on every update, and the prompt stays if
 * the user backs out.
 *
 * Read through `getPauseOffer` rather than declared on HabitDetail's `route.params`: the screen's
 * props type is part of a known TS2322 signature in TherrMobile/.tsc-baseline (routes/index.tsx),
 * and widening the params would change that signature without changing the error. Anything other
 * than the two values reads as absent.
 */
export type PauseOffer = 'open' | 'suggest';

export const getPauseOffer = (params: unknown): PauseOffer | undefined => {
    const value = (params as { pauseOffer?: unknown } | undefined)?.pauseOffer;
    return value === 'open' || value === 'suggest' ? value : undefined;
};
