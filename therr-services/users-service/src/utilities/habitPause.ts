/**
 * Pausing a habit — the pure rules. No I/O; the handler is handlers/userHabits.ts and the
 * orchestration (reminders, auto-resume) is handlers/helpers/habitPause.ts.
 *
 * WHAT A PAUSE DOES
 *
 * The local days in [pausedOn, resumedOn) are excused for that one habit (see the
 * `habits.habit_pauses` migration). Excused means "not required": the habit's own streak does not
 * count them as misses and spends no freeze on them, and the app-level daily streak does not count
 * them against the user either — a day that only a paused habit would have required becomes a rest
 * day. The streak is not extended by a paused day; it is held where it was.
 *
 * WHAT A PAUSE DOES NOT DO
 *
 *   - It does not excuse a day before it started. Pausing never rewrites a finalized day.
 *   - It does not pause anyone else. A pact's shared streak is a promise to the partner, so it keeps
 *     running; only the pausing user's own streaks are held.
 *   - It does not free the habit's slot. A paused habit is still a tracked habit; archiving is how
 *     a slot is given back.
 *
 * REMINDERS
 *
 * Pausing queues three "ready to come back?" pushes, at 7, 14 and 30 days. Each is dropped at send
 * time if the habit was resumed, archived or deleted in the meantime, so a user who comes back on
 * day 3 hears nothing. After the 30-day one we stop asking: the user was told so when they paused,
 * and an open-ended nag on something they deliberately put down is how notifications get turned
 * off. Why all three rather than one:
 *
 *   - Day 7 catches the common short breaks — illness, travel, a hard week — while the habit is
 *     still warm. Most pauses that end, end here.
 *   - Day 14 is the one nudge for the break that ran long without a decision.
 *   - Day 30 is the last ask, and it offers archiving as an equally good answer, because a month on
 *     pause is often a decision the user has not said out loud yet.
 *
 * The spacing doubles (7 → 14 → 30), the usual shape for re-engagement: frequent enough to catch a
 * short break, sparse enough not to read as nagging.
 *
 * THE COOLDOWN
 *
 * Pausing covers today, so without a limit "pause every night you skipped, resume every morning"
 * would make a streak unbreakable. A habit can therefore be paused again only
 * `PAUSE_COOLDOWN_DAYS` after its last pause ended. Resuming on the same day a pause started is an
 * undo — it covers no days, leaves no row, and starts no cooldown.
 */

import { addDays, daysBetween, isDateString } from './dailyStreak';
import { IExcusedRange } from './habitCadence';
import { localTimeToInstant } from './localReminderSchedule';

/** Days after the pause each "ready to resume?" reminder is sent. Ascending. */
export const PAUSE_REMINDER_DAYS = [7, 14, 30] as const;

/** Local time of day the reminders land: mid-morning, outside every user's quiet hours default. */
export const PAUSE_REMINDER_LOCAL_MINUTES = 10 * 60;

/** Days after a pause ends before the same habit can be paused again. */
export const PAUSE_COOLDOWN_DAYS = 7;

export interface IHabitPauseRow {
    id: string;
    userId: string;
    habitGoalId: string;
    pausedOn: string;
    resumedOn: string | null;
    pausedAt: Date;
    resumedAt: Date | null;
    streakAtPause: number;
    createdAt?: Date;
    updatedAt?: Date;
}

/** Postgres `date` comes back as a string or a Date depending on the reader; normalize either. */
export const toDateString = (value: string | Date | null | undefined): string | null => {
    if (!value) {
        return null;
    }
    const asString = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    return isDateString(asString) ? asString : null;
};

/** A stored pause as the cadence module's excused range. Null for a row it cannot read. */
export const toExcusedRange = (row: Pick<IHabitPauseRow, 'pausedOn' | 'resumedOn'>): IExcusedRange | null => {
    const from = toDateString(row.pausedOn);
    if (!from) {
        return null;
    }
    return { from, until: toDateString(row.resumedOn) };
};

/** Group pause rows into excused ranges per habit goal id. */
export const groupExcusedRangesByHabit = (rows: Pick<IHabitPauseRow, 'habitGoalId' | 'pausedOn' | 'resumedOn'>[]): Map<string, IExcusedRange[]> => {
    const byHabit = new Map<string, IExcusedRange[]>();
    rows.forEach((row) => {
        const range = toExcusedRange(row);
        if (!range) {
            return;
        }
        const ranges = byHabit.get(row.habitGoalId) || [];
        ranges.push(range);
        byHabit.set(row.habitGoalId, ranges);
    });
    return byHabit;
};

export type PauseEligibility =
    | { canPause: true }
    | { canPause: false; reason: 'already-paused' }
    | { canPause: false; reason: 'cooldown'; availableOn: string };

/**
 * May this habit be paused today? `lastClosedPause` is the most recent pause that has ended.
 */
export const getPauseEligibility = ({
    openPause,
    lastClosedPause,
    today,
}: {
    openPause?: Pick<IHabitPauseRow, 'id'> | null;
    lastClosedPause?: Pick<IHabitPauseRow, 'resumedOn'> | null;
    today: string;
}): PauseEligibility => {
    if (openPause) {
        return { canPause: false, reason: 'already-paused' };
    }
    const resumedOn = toDateString(lastClosedPause?.resumedOn);
    if (resumedOn && isDateString(today)) {
        const availableOn = addDays(resumedOn, PAUSE_COOLDOWN_DAYS);
        if (today < availableOn) {
            return { canPause: false, reason: 'cooldown', availableOn };
        }
    }
    return { canPause: true };
};

/** The app's locale codes as BCP 47 tags for Intl. Anything else reads as English. */
const INTL_LOCALES: Record<string, string> = {
    'en-us': 'en-US',
    es: 'es',
    'fr-ca': 'fr-CA',
};

/**
 * A local day ('YYYY-MM-DD') as the user would write it — "November 14", "14 de noviembre",
 * "14 novembre" — for sentences like "you can pause it again on {date}". The year is shown only
 * when it is not `today`'s, so a cooldown that crosses New Year's still names the right one.
 *
 * Formatted in UTC from the date's own parts: the input is already a calendar day in the user's
 * zone, and formatting it in the server's zone could move it back a day. A value it cannot
 * read is returned unchanged rather than dropped from the sentence.
 */
export const formatLocalDateForLocale = (localDate: string, locale?: string | null, today?: string): string => {
    if (!isDateString(localDate)) {
        return localDate;
    }
    const [year, month, day] = localDate.split('-').map((part) => parseInt(part, 10));
    const showYear = !isDateString(today || '') || (today as string).slice(0, 4) !== localDate.slice(0, 4);
    const intlLocale = INTL_LOCALES[String(locale || '').toLowerCase()] || INTL_LOCALES['en-us'];
    try {
        return new Intl.DateTimeFormat(intlLocale, {
            month: 'long',
            day: 'numeric',
            ...(showYear ? { year: 'numeric' as const } : {}),
            timeZone: 'UTC',
        }).format(new Date(Date.UTC(year, month - 1, day)));
    } catch {
        return localDate;
    }
};

/** How many days a pause has been running as of `today` (0 on the day it started). */
export const getDaysPaused = (pausedOn: string | Date, today: string): number => {
    const from = toDateString(pausedOn);
    if (!from || !isDateString(today)) {
        return 0;
    }
    return Math.max(0, daysBetween(from, today));
};

export interface IPauseReminder {
    /** Days after the pause — also what the push copy keys its stage on. */
    dayCount: number;
    /** The local day it lands on. */
    localDate: string;
    /** The instant it is queued for. */
    scheduledFor: Date;
}

/**
 * When each reminder for a pause starting on `pausedOn` goes out: that many days later, at
 * PAUSE_REMINDER_LOCAL_MINUTES in the user's zone. A zone that cannot be resolved falls back to the
 * same time of day the pause was made, which is at least a time the user was demonstrably awake.
 */
export const getPauseReminderSchedule = ({
    pausedOn,
    timeZone,
    pausedAt,
}: {
    pausedOn: string;
    timeZone: string;
    pausedAt: Date;
}): IPauseReminder[] => PAUSE_REMINDER_DAYS.map((dayCount) => {
    const localDate = addDays(pausedOn, dayCount);
    const [year, month, day] = localDate.split('-').map((part) => parseInt(part, 10));
    const instant = localTimeToInstant(timeZone, { year, month, day }, PAUSE_REMINDER_LOCAL_MINUTES);
    return {
        dayCount,
        localDate,
        scheduledFor: instant || new Date(pausedAt.getTime() + dayCount * 24 * 60 * 60 * 1000),
    };
});

/**
 * Whether a check-in nudge should offer "Pause" as a way out — the last-resort option for a streak
 * that will end tonight. All four must hold:
 *
 *   - it names exactly one habit (`habitGoalId`): the action pauses one habit, and a roll-up has
 *     no unambiguous one;
 *   - that habit has a live streak: with nothing at stake, pausing protects nothing;
 *   - its freezes are known to be spent (`freezesRemaining === 0`, not merely absent): while a
 *     freeze would cover tonight, the nudge already says so and pausing is not the answer;
 *   - the habit can actually be paused right now — decided by the caller from the pause history,
 *     because offering a button the server will refuse is worse than no button.
 */
export const shouldOfferPauseOnNudge = (payload: {
    habitGoalId?: string;
    streakCount?: number;
    freezesRemaining?: number;
}): boolean => !!payload.habitGoalId
    && Number(payload.streakCount) > 0
    && payload.freezesRemaining !== undefined
    && payload.freezesRemaining !== null
    && Number(payload.freezesRemaining) === 0;

/** Dedup key for one reminder of one pause. Keyed on the pause row — never on a clock value. */
export const getPauseReminderDedupeKey = (pauseId: string, dayCount: number): string => `habit-pause-reminder:${pauseId}:${dayCount}`;
