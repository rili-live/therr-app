/**
 * App-level daily streak — the pure rules. No I/O; the orchestration that loads check-ins,
 * borrows freezes from habit streaks and writes the ledger lives in
 * handlers/helpers/dailyStreak.ts.
 *
 * Namespacing: this is the *daily* streak (per user, across all habits). The per-habit streak
 * is `habits.streaks` / utilities/streakHelpers.ts and is a different thing. Everything here is
 * prefixed `dailyStreak` / `DAILY_STREAK_` so the two never blur.
 *
 * Rules (decided; see docs/FEATURES.md → Daily streak):
 *   - A day is the user's *local* calendar day. `habit_checkins.localDate` is stamped at write
 *     time from the user's IANA zone, so "23:50 on Sep 12 in Chicago" is Sep 12 here even
 *     though the service's UTC habit day (`scheduledDate`) is already Sep 13.
 *   - Upheld: >= 1 completed check-in on any habit with localDate = D.
 *   - Missed, freeze available: borrow exactly one freeze from exactly one habit's streak row
 *     (highest freezes remaining → longest per-habit streak → oldest habit). The day is
 *     'frozen': the streak continues but the day is not "perfect".
 *   - Missed, no freezes: streak resets to 0; `longest` is retained.
 *   - Several missed days are evaluated one by one, one freeze per day, until freezes run out.
 *   - Perfect week: every day of a Monday–Sunday week upheld by a real check-in (no frozen days).
 */

import { getLocalParts, isValidTimeZone, FALLBACK_TIME_ZONE } from './localReminderSchedule';

export type DailyStreakDayStatus = 'upheld' | 'frozen' | 'missed';

/** Milestones that get the big celebration, then every 500 days past 1000. */
export const DAILY_STREAK_MILESTONES = [7, 30, 50, 100, 200, 365, 500, 730, 1000];
const DAILY_STREAK_MILESTONE_STEP_AFTER_LAST = 500;

export const isDailyStreakMilestone = (streak: number): boolean => {
    if (!Number.isInteger(streak) || streak <= 0) {
        return false;
    }
    if (streak <= DAILY_STREAK_MILESTONES[DAILY_STREAK_MILESTONES.length - 1]) {
        return DAILY_STREAK_MILESTONES.includes(streak);
    }
    return streak % DAILY_STREAK_MILESTONE_STEP_AFTER_LAST === 0;
};

export const CONSECUTIVE_PERFECT_WEEKS_FOR_ACHIEVEMENT = 4;
/** A reset from at least this long a streak makes the next 7-day streak a "comeback". */
export const COMEBACK_RESET_FROM_MIN = 30;
export const COMEBACK_STREAK_LENGTH = 7;

// ---------------------------------------------------------------------------------------------
// Date arithmetic on YYYY-MM-DD strings, done in UTC so the host timezone never leaks in.
// ---------------------------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toUtcDate = (dateString: string): Date => new Date(`${dateString.slice(0, 10)}T00:00:00.000Z`);

const fromUtcDate = (date: Date): string => date.toISOString().slice(0, 10);

export const addDays = (dateString: string, days: number): string => {
    const d = toUtcDate(dateString);
    d.setUTCDate(d.getUTCDate() + days);
    return fromUtcDate(d);
};

/** Whole days from `a` to `b` (positive when b is later). */
export const daysBetween = (a: string, b: string): number => Math.round(
    (toUtcDate(b).getTime() - toUtcDate(a).getTime()) / MS_PER_DAY,
);

/** 0 = Monday … 6 = Sunday. Weeks start on Monday, matching the leaderboard period. */
export const getDayOfWeekMondayFirst = (dateString: string): number => (toUtcDate(dateString).getUTCDay() + 6) % 7;

/** Monday of the week containing `dateString`. */
export const getWeekStart = (dateString: string): string => addDays(dateString, -getDayOfWeekMondayFirst(dateString));

/** Sunday of the week containing `dateString`. */
export const getWeekEnd = (dateString: string): string => addDays(getWeekStart(dateString), 6);

export const isWeekEnd = (dateString: string): boolean => getDayOfWeekMondayFirst(dateString) === 6;

/** ISO 8601 date-only check: what every date input to this module must satisfy. */
export const isDateString = (value: unknown): value is string => (
    typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(toUtcDate(value).getTime())
);

// ---------------------------------------------------------------------------------------------
// Timezone → local day
// ---------------------------------------------------------------------------------------------

/**
 * Which zone a check-in's local day is computed in: the user's saved zone first (the same
 * column the digest schedules reminders by), then the device zone the client reported on this
 * request, then the service fallback. Junk in either input falls through to the next.
 */
export const resolveCheckinTimeZone = (
    settingsTimezone: unknown,
    deviceTimezone?: unknown,
): string => {
    if (isValidTimeZone(settingsTimezone)) {
        return settingsTimezone.trim();
    }
    if (isValidTimeZone(deviceTimezone)) {
        return deviceTimezone.trim();
    }
    return FALLBACK_TIME_ZONE;
};

/** The user's calendar date (YYYY-MM-DD) at `at` in `timeZone`. */
export const getLocalDate = (timeZone: string, at: Date = new Date()): string => {
    const parts = getLocalParts(timeZone, at) || getLocalParts(FALLBACK_TIME_ZONE, at);
    // Both zones are validated IANA names; the fallback is a constant. This branch is
    // unreachable in practice but keeps the return type honest.
    return parts ? parts.date : fromUtcDate(at);
};

/**
 * The zone whose local day is furthest ahead (UTC+14, no DST). When a user's own zone cannot be
 * resolved, "today" in this zone is the latest calendar date any client on Earth can honestly
 * report, so clamping to it rejects nothing legitimate.
 */
const LATEST_LOCAL_DAY_TIME_ZONE = 'Pacific/Kiritimati';

/**
 * The latest local day a "celebrated" report may name.
 *
 * With a resolvable zone (saved `settingsTimezone`, else the device zone on the request) that
 * is the user's own today. Without one it is the latest today anywhere, NOT the service
 * fallback zone: a client east of that fallback would have its real today clamped to the
 * fallback's yesterday, and the next summary read would offer the same celebration again.
 * Anything later than the bound is a skewed clock or a hand-made request, and is pulled back to
 * it so it cannot silence celebrations until that day arrives. Earlier dates pass through.
 */
export const clampCelebratedDate = (
    requestedDate: string,
    { settingsTimezone, deviceTimezone }: { settingsTimezone: unknown; deviceTimezone?: unknown },
    now: Date = new Date(),
): string => {
    const hasOwnZone = isValidTimeZone(settingsTimezone) || isValidTimeZone(deviceTimezone);
    const latest = hasOwnZone
        ? getLocalDate(resolveCheckinTimeZone(settingsTimezone, deviceTimezone), now)
        : getLocalDate(LATEST_LOCAL_DAY_TIME_ZONE, now);
    return requestedDate > latest ? latest : requestedDate;
};

/** How many days into the past a check-in may be backdated and still move the daily streak. */
export const MAX_BACKDATE_DAYS = 1;

/**
 * The habit day a check-in is credited to — what lands in `habit_checkins.scheduledDate` and
 * what the per-habit streak in `habits.streaks` counts.
 *
 * **This is the user's local calendar day, not UTC.** It used to be UTC, and that is what made
 * a 19:00 check-in on Sep 15 in Chicago show up on the 16th: the write stamped the UTC day
 * while every calendar the app renders is built from local components. One clock, and it is
 * the user's.
 *
 * `requestedDate` is whatever the client asked for (`scheduledDate` on the request). It is
 * honoured for today and any earlier day — backdating a missed day is a real feature — but
 * clamped down to the user's today when it is ahead of it. That clamp is the whole
 * backwards-compatibility story: installed app versions still send the UTC day, which is
 * *ahead* of the user's day for exactly the evening hours that produced the bug, so the fix
 * reaches every existing install without waiting on a store release. A device with a skewed
 * clock is pulled back by the same rule.
 */
export const resolveCheckinHabitDate = ({
    requestedDate,
    timeZone,
    now = new Date(),
}: {
    requestedDate?: unknown;
    timeZone: string;
    now?: Date;
}): string => {
    const today = getLocalDate(timeZone, now);

    if (isDateString(requestedDate) && requestedDate <= today) {
        return requestedDate;
    }

    return today;
};

/**
 * The local day a check-in belongs to — `habit_checkins.localDate`, what the *app-level* daily
 * streak reads.
 *
 * Since `scheduledDate` became the user's local day too (see `resolveCheckinHabitDate`) the two
 * agree for every ordinary check-in, and this exists for the cases where they can still differ:
 *
 *   - a legacy client sending the UTC day, which is clamped to the user's today here exactly as
 *     it is for the habit day — that is what makes 23:50 on Sep 12 in America/Chicago a Sep 12
 *     check-in even though the client stamped Sep 13;
 *   - a backdated check-in, shifted back from the user's today by the number of days it is
 *     behind, so "log yesterday" means the user's yesterday;
 *   - an explicit `requestedLocalDate` from a client that knows its own calendar, which wins,
 *     but only within [today - MAX_BACKDATE_DAYS, today]: beyond that the check-in still counts
 *     for the habit, and the returned date simply falls outside the window the daily streak
 *     reacts to.
 */
export const resolveCheckinLocalDate = ({
    scheduledDate,
    requestedLocalDate,
    timeZone,
    now = new Date(),
}: {
    scheduledDate?: string;
    requestedLocalDate?: unknown;
    timeZone: string;
    now?: Date;
}): string => {
    const today = getLocalDate(timeZone, now);

    if (isDateString(requestedLocalDate)) {
        const offset = daysBetween(requestedLocalDate, today);
        if (offset >= 0 && offset <= MAX_BACKDATE_DAYS) {
            return requestedLocalDate;
        }
    }

    if (isDateString(scheduledDate)) {
        // Measured against the user's own today, not UTC's. Measuring against the UTC day was
        // correct only while `scheduledDate` was itself a UTC day; with a local `scheduledDate`
        // it double-counts the offset and files an evening check-in in any zone west of UTC
        // under *yesterday*.
        const backdatedBy = daysBetween(
            resolveCheckinHabitDate({ requestedDate: scheduledDate, timeZone, now }),
            today,
        );
        if (backdatedBy > 0) {
            return addDays(today, -backdatedBy);
        }
    }

    return today;
};

// ---------------------------------------------------------------------------------------------
// Freeze pool
// ---------------------------------------------------------------------------------------------

export interface IFreezeSource {
    /** habits.streaks.id — what gets decremented. */
    streakId: string;
    habitGoalId: string;
    freezesRemaining: number;
    /** The habit's own streak, for the tie-break. */
    currentStreak: number;
    /** When the habit's streak row was created, for the final tie-break (oldest wins). */
    createdAt: string | Date | null;
}

const toMillis = (value: string | Date | null): number => {
    if (!value) {
        return Number.MAX_SAFE_INTEGER;
    }
    const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
};

/**
 * Which habit lends the freeze for a missed day. Highest freezes remaining, tie → longest
 * per-habit streak, tie → oldest habit. Returns undefined when nobody has one to lend.
 */
export const pickFreezeSource = (sources: IFreezeSource[]): IFreezeSource | undefined => sources
    .filter((source) => source.freezesRemaining > 0)
    .sort((a, b) => (
        (b.freezesRemaining - a.freezesRemaining)
        || (b.currentStreak - a.currentStreak)
        || (toMillis(a.createdAt) - toMillis(b.createdAt))
        || a.habitGoalId.localeCompare(b.habitGoalId)
    ))[0];

// ---------------------------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------------------------

export interface IDailyStreakWalkState {
    /** Streak length as of the day before `fromDate`. */
    currentStreak: number;
    longestStreak: number;
    consecutivePerfectWeeks: number;
    /** Length of the streak the last reset destroyed (0 if none, or if the comeback was already banked). */
    lastResetFromStreak: number;
}

export interface IDailyStreakDayResult {
    localDate: string;
    status: DailyStreakDayStatus;
    freezeHabitGoalId: string | null;
    streakAfter: number;
}

export interface IDailyStreakWalkEvents {
    /** Milestones reached for the first time ever (streak length exceeded the previous longest). */
    milestonesReached: number[];
    /** A Monday–Sunday week closed with all seven days upheld. */
    perfectWeeksClosed: number;
    /** `consecutivePerfectWeeks` hit CONSECUTIVE_PERFECT_WEEKS_FOR_ACHIEVEMENT during this walk. */
    reachedConsecutivePerfectWeeks: boolean;
    /** At least one day in this walk was saved by a freeze. */
    freezeSaved: boolean;
    /** The streak reached COMEBACK_STREAK_LENGTH after a reset from >= COMEBACK_RESET_FROM_MIN. */
    comeback: boolean;
    /** The last upheld day in this walk, or null if none. */
    lastUpheldDate: string | null;
}

export interface IDailyStreakWalkArgs {
    state: IDailyStreakWalkState;
    /** First day to evaluate (inclusive). */
    fromDate: string;
    /** Last day to evaluate (inclusive). Nothing happens when upTo < fromDate. */
    upTo: string;
    /** Local days with >= 1 completed check-in. Only days in [fromDate, upTo] are consulted. */
    upheldDates: Set<string>;
    /** Freeze pool. Mutated: `freezesRemaining` is decremented as freezes are borrowed. */
    freezeSources: IFreezeSource[];
    /**
     * Statuses already on the ledger for days of the week containing `fromDate` that precede
     * it — needed to judge a perfect week when the walk starts mid-week. Days absent from
     * both this map and the walk count as missed.
     */
    priorWeekStatuses?: Map<string, DailyStreakDayStatus>;
    /**
     * When false, missed days never borrow a freeze (they reset instead). Used for the one-time
     * backfill of a user's history: the freezes those old gaps would have consumed were already
     * spent by the per-habit streak logic at the time, and re-spending today's pool on
     * months-old gaps would leave the user without a net for the day that matters.
     */
    allowFreezes?: boolean;
}

export interface IDailyStreakWalkResult {
    days: IDailyStreakDayResult[];
    state: IDailyStreakWalkState;
    /** habits.streaks.id → number of freezes borrowed from it during this walk. */
    freezesBorrowed: Map<string, number>;
    events: IDailyStreakWalkEvents;
}

/**
 * Evaluate every local day in [fromDate, upTo], one by one, applying the rules above. Pure:
 * the same inputs always produce the same days, which is what makes re-running an evaluation
 * a no-op at the ledger (the orchestrator upserts by (userId, localDate)).
 */
export const walkDailyStreakDays = ({
    state: initialState,
    fromDate,
    upTo,
    upheldDates,
    freezeSources,
    priorWeekStatuses,
    allowFreezes = true,
}: IDailyStreakWalkArgs): IDailyStreakWalkResult => {
    const state: IDailyStreakWalkState = { ...initialState };
    const days: IDailyStreakDayResult[] = [];
    const freezesBorrowed = new Map<string, number>();
    const events: IDailyStreakWalkEvents = {
        milestonesReached: [],
        perfectWeeksClosed: 0,
        reachedConsecutivePerfectWeeks: false,
        freezeSaved: false,
        comeback: false,
        lastUpheldDate: null,
    };

    if (!isDateString(fromDate) || !isDateString(upTo) || daysBetween(fromDate, upTo) < 0) {
        return {
            days, state, freezesBorrowed, events,
        };
    }

    // Statuses for the perfect-week check: what the ledger already holds for this week, plus
    // what this walk decides. Reset at each Monday.
    const weekStatuses = new Map<string, DailyStreakDayStatus>(priorWeekStatuses || []);

    const totalDays = daysBetween(fromDate, upTo);
    for (let offset = 0; offset <= totalDays; offset += 1) {
        const localDate = addDays(fromDate, offset);

        if (getDayOfWeekMondayFirst(localDate) === 0) {
            weekStatuses.clear();
        }

        let status: DailyStreakDayStatus;
        let freezeHabitGoalId: string | null = null;

        if (upheldDates.has(localDate)) {
            status = 'upheld';
            const streakBefore = state.currentStreak;
            state.currentStreak = streakBefore + 1;
            events.lastUpheldDate = localDate;

            if (state.currentStreak > state.longestStreak) {
                // First time this length has ever been reached — the only time a milestone
                // earns its achievement. A later streak that reaches the same length still
                // gets the celebration screen (the client reads isDailyStreakMilestone), but
                // the achievement ladder has already been climbed.
                state.longestStreak = state.currentStreak;
                if (isDailyStreakMilestone(state.currentStreak)) {
                    events.milestonesReached.push(state.currentStreak);
                }
            }

            if (state.currentStreak === COMEBACK_STREAK_LENGTH && state.lastResetFromStreak >= COMEBACK_RESET_FROM_MIN) {
                events.comeback = true;
                state.lastResetFromStreak = 0;
            }
        } else {
            const source = allowFreezes && state.currentStreak > 0 ? pickFreezeSource(freezeSources) : undefined;
            if (source) {
                status = 'frozen';
                freezeHabitGoalId = source.habitGoalId;
                source.freezesRemaining -= 1;
                freezesBorrowed.set(source.streakId, (freezesBorrowed.get(source.streakId) || 0) + 1);
                events.freezeSaved = true;
                // The streak continues, unchanged.
            } else {
                status = 'missed';
                if (state.currentStreak >= COMEBACK_RESET_FROM_MIN) {
                    state.lastResetFromStreak = state.currentStreak;
                }
                state.currentStreak = 0;
            }
        }

        weekStatuses.set(localDate, status);
        days.push({
            localDate,
            status,
            freezeHabitGoalId,
            streakAfter: state.currentStreak,
        });

        if (isWeekEnd(localDate)) {
            const weekStart = getWeekStart(localDate);
            let isPerfect = true;
            for (let i = 0; i < 7; i += 1) {
                if (weekStatuses.get(addDays(weekStart, i)) !== 'upheld') {
                    isPerfect = false;
                    break;
                }
            }
            if (isPerfect) {
                events.perfectWeeksClosed += 1;
                state.consecutivePerfectWeeks += 1;
                if (state.consecutivePerfectWeeks === CONSECUTIVE_PERFECT_WEEKS_FOR_ACHIEVEMENT) {
                    events.reachedConsecutivePerfectWeeks = true;
                }
            } else {
                state.consecutivePerfectWeeks = 0;
            }
        }
    }

    return {
        days, state, freezesBorrowed, events,
    };
};

/**
 * Whether the week containing `dateString` is perfect *so far through that day* — every day
 * from Monday up to and including it is upheld. On a Sunday this is the full perfect week;
 * earlier in the week it is "on track". The celebration copy uses the Sunday form.
 */
export const isWeekPerfectThrough = (
    dateString: string,
    statuses: Map<string, DailyStreakDayStatus | 'future' | 'pending'>,
): boolean => {
    const weekStart = getWeekStart(dateString);
    const dayIndex = getDayOfWeekMondayFirst(dateString);
    for (let i = 0; i <= dayIndex; i += 1) {
        if (statuses.get(addDays(weekStart, i)) !== 'upheld') {
            return false;
        }
    }
    return true;
};
