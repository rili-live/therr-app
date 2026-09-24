/**
 * Habit cadence — the one definition of "did you hold up your end".
 *
 * Until this module existed the question had four answers that disagreed:
 *
 *   - `isHabitDueToday` (streakHelpers) gated the daily reminder on a *spacing* heuristic,
 *     `floor(7 / N)`, so 4x, 5x, 6x and 7x per week all collapsed to "due every day".
 *   - `countScheduledCheckins` (pactMemberStats) implemented a real weekly quota, and its own
 *     comment said the two "must agree".
 *   - `countMissedDaysForStreak` (streakHelpers) ignored `frequencyCount` entirely and honoured
 *     `targetDaysOfWeek` only when `frequencyType === 'weekly'`, so a `custom` goal with fixed
 *     days was nudged on those days and scored against all seven.
 *   - `wasDayMissed` (streakHelpers) held a fourth copy and had no callers at all.
 *
 * Everything now routes through here. The three survivors above are thin adapters.
 *
 * THE RULE THAT MATTERS
 *
 * For a "4x per week, any days" habit, a day is *required* only once skipping it would put the
 * quota out of reach — `daysRemainingInWeek <= quotaRemaining`. Every earlier day is *optional*:
 * it can be skipped freely, costs no streak and, critically, **borrows no streak freeze**. That
 * is the whole point of the feature. Before it, someone doing four workouts a week spent a
 * freeze on each of their three off days, ran the pool dry (it caps at 3) and lost the streak
 * they had actually earned.
 *
 * WEEK BOUNDARIES
 *
 * Weeks are Monday–Sunday, matching `getWeekStart` in dailyStreak.ts and the leaderboard period.
 * Dates in and out are YYYY-MM-DD strings in the *user's own local day* (what
 * `resolveCheckinHabitDate` stamps on `scheduledDate`), stepped in UTC so the host timezone
 * never leaks in. `targetDaysOfWeek` is Sunday-first (0 = Sunday), because that is the JS
 * `getDay()` convention the column was populated against and what `isHabitDueToday` read with
 * `getUTCDay()`; week boundaries are Monday-first. The two are deliberately separate helpers
 * here so the off-by-one that split `getUTCDay()` from `getDay()` across the old predicates
 * cannot come back.
 */

import {
    addDays,
    daysBetween,
    getWeekStart,
    getDayOfWeekMondayFirst,
    isDateString,
} from './dailyStreak';

export const DAYS_PER_WEEK = 7;

export type Cadence =
    | { kind: 'daily' }
    | { kind: 'weekdays'; days: number[] }
    | { kind: 'weeklyQuota'; count: number };

/** The shape `getCadence` reads. Every field is optional — a goal row satisfies it. */
export interface ICadenceSource {
    frequencyType?: string | null;
    frequencyCount?: number | null;
    targetDaysOfWeek?: number[] | null;
    /**
     * `habits.habit_goals.cadenceEffectiveFrom`. Evaluation never reaches back past this date,
     * which is what makes a cadence change forward-only and what grandfathers habits that were
     * already non-daily when this shipped. NULL means "always".
     */
    cadenceEffectiveFrom?: string | Date | null;
}

/** 0 = Sunday … 6 = Saturday, matching `targetDaysOfWeek`. */
export const getDayOfWeekSundayFirst = (dateString: string): number => (getDayOfWeekMondayFirst(dateString) + 1) % 7;

/** Days from `dateString` through that week's Sunday, inclusive of `dateString` itself. */
export const getDaysRemainingInWeek = (dateString: string): number => DAYS_PER_WEEK - getDayOfWeekMondayFirst(dateString);

const sanitizeTargetDays = (value?: number[] | null): number[] => {
    if (!Array.isArray(value)) {
        return [];
    }
    const days = value
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
    return Array.from(new Set(days)).sort((a, b) => a - b);
};

/**
 * Normalize a goal's three cadence columns into one discriminated union.
 *
 * Precedence is deliberately identical to what `isHabitDueToday` already enforced and what
 * `tests/unit/habitDueToday.test.ts` pins: an explicit weekday schedule is the strongest signal
 * the user has given and wins over `frequencyType` in both directions, then `daily`, then a
 * per-week count.
 *
 * A malformed `frequencyCount` (0, null, negative, NaN) degrades to 1/week — the quiet
 * direction, for the reason spelled out on the old `isHabitDueToday`: over-reminding on bad
 * data is visible to the user, as spam.
 */
export const getCadence = (goal?: ICadenceSource | null): Cadence => {
    const days = sanitizeTargetDays(goal?.targetDaysOfWeek);
    if (days.length) {
        return { kind: 'weekdays', days };
    }

    const frequencyType = goal?.frequencyType || 'daily';
    if (frequencyType === 'daily') {
        return { kind: 'daily' };
    }

    const count = Math.max(1, Math.min(DAYS_PER_WEEK, Number(goal?.frequencyCount) || 1));
    return { kind: 'weeklyQuota', count };
};

/**
 * Whether an edit to a goal changes what its cadence *means*, as opposed to how its columns are
 * spelled. `patch` holds only the fields the edit supplies; an absent field keeps its old value.
 *
 * This is what decides whether an edit stamps `cadenceEffectiveFrom`. Stamping on every edit
 * would be wrong in the lenient direction: renaming a daily habit would put its whole gap beyond
 * evaluation and quietly forgive every day missed in it.
 */
export const hasCadenceChanged = (existing: ICadenceSource | null | undefined, patch: ICadenceSource): boolean => {
    const pick = <K extends keyof ICadenceSource>(key: K) => (patch[key] !== undefined ? patch[key] : existing?.[key]);
    const before = getCadence(existing);
    const after = getCadence({
        frequencyType: pick('frequencyType') as string | null | undefined,
        frequencyCount: pick('frequencyCount') as number | null | undefined,
        targetDaysOfWeek: pick('targetDaysOfWeek') as number[] | null | undefined,
    });
    return JSON.stringify(before) !== JSON.stringify(after);
};

/** How many check-ins a full Monday–Sunday week of this cadence calls for. */
export const getWeeklyTarget = (cadence: Cadence): number => {
    if (cadence.kind === 'daily') {
        return DAYS_PER_WEEK;
    }
    if (cadence.kind === 'weekdays') {
        return cadence.days.length;
    }
    return cadence.count;
};

/** The date the cadence became authoritative, or null when it always was. */
export const getCadenceEffectiveFrom = (goal?: ICadenceSource | null): string | null => {
    const raw = goal?.cadenceEffectiveFrom;
    if (!raw) {
        return null;
    }
    const asString = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).slice(0, 10);
    return isDateString(asString) ? asString : null;
};

/**
 * Is this habit *required* on `localDate` — i.e. does skipping it cost something?
 *
 * `completionsEarlierThisWeek` counts completed check-ins for this habit from that week's Monday
 * up to but **not including** `localDate`.
 *
 * For `weeklyQuota` this is intentionally false for most of a well-run week. A 4x/week user who
 * trains Mon–Thu has *zero* required days: the quota is met before skipping could ever endanger
 * it. That is correct for streaks and freezes, and it is why the reminder pass keys off
 * `isQuotaUnmet` instead — gating reminders on this would nudge that user never.
 */
export const isRequiredOn = (
    cadence: Cadence,
    localDate: string,
    completionsEarlierThisWeek = 0,
): boolean => {
    if (!isDateString(localDate)) {
        return false;
    }

    if (cadence.kind === 'daily') {
        return true;
    }

    if (cadence.kind === 'weekdays') {
        return cadence.days.includes(getDayOfWeekSundayFirst(localDate));
    }

    const remaining = cadence.count - Math.max(0, completionsEarlierThisWeek);
    if (remaining <= 0) {
        return false;
    }
    return getDaysRemainingInWeek(localDate) <= remaining;
};

/**
 * Does the habit still owe check-ins this week? The reminder gate.
 *
 * Unlike `isRequiredOn` this stays true across the whole early part of the week and goes false
 * the moment the quota is met, which is exactly the shape a reminder wants: keep asking until
 * they have done their four, then stay quiet for the rest of the week.
 */
export const isQuotaUnmet = (cadence: Cadence, localDate: string, completionsThisWeek = 0): boolean => {
    if (!isDateString(localDate)) {
        return false;
    }

    if (cadence.kind === 'weekdays') {
        // A fixed schedule has no quota to run down — the day either is or isn't one of theirs.
        return cadence.days.includes(getDayOfWeekSundayFirst(localDate));
    }

    return Math.max(0, completionsThisWeek) < getWeeklyTarget(cadence);
};

/** Every date in the Monday–Sunday week containing `dateString`, in order. */
export const getWeekDates = (dateString: string): string[] => {
    const weekStart = getWeekStart(dateString);
    return Array.from({ length: DAYS_PER_WEEK }, (_unused, i) => addDays(weekStart, i));
};

/**
 * Did a closed Monday–Sunday week satisfy the cadence? `completedDates` may hold dates outside
 * the week; only the ones inside it are consulted.
 */
export const isPeriodSatisfied = (
    cadence: Cadence,
    weekStart: string,
    completedDates: Set<string> | string[],
): boolean => {
    const completed = completedDates instanceof Set ? completedDates : new Set(completedDates);
    const weekDates = getWeekDates(weekStart);

    if (cadence.kind === 'weekdays') {
        return weekDates
            .filter((date) => cadence.days.includes(getDayOfWeekSundayFirst(date)))
            .every((date) => completed.has(date));
    }

    const hits = weekDates.filter((date) => completed.has(date)).length;
    return hits >= getWeeklyTarget(cadence);
};

export interface ICountMissedArgs {
    /** The user's last completed check-in for this habit, YYYY-MM-DD. */
    lastCompletedDate: string;
    /** The check-in being processed now, YYYY-MM-DD. */
    throughDate: string;
    /**
     * Completed local dates for this habit, anywhere in [lastCompletedDate, throughDate]. Only
     * consulted for `weeklyQuota`, where a week's verdict needs the whole week's count rather
     * than just the gap endpoints.
     */
    completedDates?: Set<string> | string[];
    /** `cadenceEffectiveFrom` — the walk never starts before this. */
    effectiveFrom?: string | null;
}

/**
 * How many of the habit's obligations went unmet between the last completion and this check-in.
 * 0 means the streak is intact. The check-in flow spends that many streak freezes, or resets.
 *
 * Replaces `countMissedDaysForStreak`, and for `daily` and `weekdays` returns exactly what that
 * function returned — that equivalence is what makes this a no-op for the overwhelming majority
 * of rows, and there is a regression test asserting it.
 *
 * For `weeklyQuota` the unit is a **week**, not a day, because a quota's failure is only knowable
 * once the week closes. Only weeks that have fully elapsed are judged; the week `throughDate`
 * falls in is still in progress and the check-in being processed is part of it, so it is never
 * counted as a miss here.
 */
export const countMissedPeriods = (cadence: Cadence, args: ICountMissedArgs): number => {
    const { lastCompletedDate, throughDate, effectiveFrom } = args;
    if (!isDateString(lastCompletedDate) || !isDateString(throughDate)) {
        return 0;
    }

    // A cadence that only became authoritative partway through the gap must not be used to judge
    // the part before it. This is what stops the stricter weekly rule retroactively breaking a
    // streak that was earned under the old, effectively-unbreakable one.
    const from = effectiveFrom && isDateString(effectiveFrom) && effectiveFrom > lastCompletedDate
        ? effectiveFrom
        : lastCompletedDate;

    if (cadence.kind === 'weeklyQuota') {
        const completed = args.completedDates instanceof Set
            ? args.completedDates
            : new Set(args.completedDates || []);

        let missed = 0;
        const currentWeekStart = getWeekStart(throughDate);
        let weekStart = getWeekStart(from);
        // A week the cadence only governed part of is not this cadence's to judge. When the
        // effective date lands mid-week — the deploy that backfilled it, or a user's own edit —
        // the first week held to the quota is the next full one, matching `computeRequiredDates`,
        // which treats every day before `effectiveFrom` as not required.
        if (effectiveFrom && isDateString(effectiveFrom) && effectiveFrom > getWeekStart(lastCompletedDate)) {
            const effectiveWeekStart = getWeekStart(effectiveFrom);
            weekStart = effectiveWeekStart === effectiveFrom
                ? effectiveFrom
                : addDays(effectiveWeekStart, DAYS_PER_WEEK);
        }

        // The week of the last completion is only judged if it closed before `throughDate`.
        while (weekStart < currentWeekStart) {
            if (!isPeriodSatisfied(cadence, weekStart, completed)) {
                missed += 1;
            }
            weekStart = addDays(weekStart, DAYS_PER_WEEK);
        }

        return missed;
    }

    const daysDiff = daysBetween(from, throughDate);
    if (daysDiff <= 1) {
        return 0;
    }

    if (cadence.kind === 'weekdays') {
        let missed = 0;
        for (let i = 1; i < daysDiff; i += 1) {
            if (cadence.days.includes(getDayOfWeekSundayFirst(addDays(from, i)))) {
                missed += 1;
            }
        }
        return missed;
    }

    // Daily: every uncompleted day strictly inside the gap is a miss.
    return daysDiff - 1;
};

/**
 * How many check-ins the cadence called for across an inclusive date range — the denominator of
 * a completion rate, and of the phase engine's consistency percentage.
 *
 * Dividing by calendar days instead is what made a perfectly-executed 3x/week habit score 43%,
 * which sits below the phase engine's `LAPSE_MAX_CONSISTENCY` and would have classified it
 * `lapsed` the moment that engine was switched on.
 */
export const countScheduledForRange = (
    cadence: Cadence,
    startDate: string,
    endDate: string,
): number => {
    if (!isDateString(startDate) || !isDateString(endDate)) {
        return 0;
    }
    const totalDays = daysBetween(startDate, endDate) + 1;
    if (totalDays <= 0) {
        return 0;
    }

    if (cadence.kind === 'daily') {
        return totalDays;
    }

    if (cadence.kind === 'weekdays') {
        // Walk by day-of-week offset rather than by Date arithmetic so a DST boundary inside the
        // window cannot drop a day.
        const startDayOfWeek = getDayOfWeekSundayFirst(startDate);
        let scheduled = 0;
        for (let i = 0; i < totalDays; i += 1) {
            if (cadence.days.includes((startDayOfWeek + i) % DAYS_PER_WEEK)) {
                scheduled += 1;
            }
        }
        return scheduled;
    }

    // A partial week still owes its full target — that is the cadence the user signed up for —
    // but the target can never exceed the days actually available.
    return Math.min(totalDays, Math.ceil(totalDays / DAYS_PER_WEEK) * cadence.count);
};

export interface IRequiredDaysHabit {
    habitGoalId: string;
    cadence: Cadence;
    /** The habit's own local start day. Days before it were never this habit's to require. */
    startedOn?: string | null;
    /** `cadenceEffectiveFrom`; days before it are judged by no cadence at all. */
    effectiveFrom?: string | null;
}

/**
 * Which local days in [fromDate, upTo] at least one habit *required*.
 *
 * This is what turns a day nothing was asked on into a rest day rather than a missed one, and it
 * is the whole reason a 4x/week user stops burning a freeze on each of their three off days.
 *
 * A quota is evaluated day by day in order, because whether Saturday is required depends on how
 * much of the week is already done — so each habit's running tally has to advance as the walk
 * does, and it resets at every Monday.
 *
 * `completions` is every (habit, local day) the user completed; it should reach back to the
 * Monday of the week containing `fromDate` so a mid-week start sees the days before it.
 */
export const computeRequiredDates = ({
    habits,
    fromDate,
    upTo,
    completions,
}: {
    habits: IRequiredDaysHabit[];
    fromDate: string;
    upTo: string;
    completions: { habitGoalId: string; localDate: string }[];
}): Set<string> => {
    const required = new Set<string>();
    if (!isDateString(fromDate) || !isDateString(upTo) || daysBetween(fromDate, upTo) < 0) {
        return required;
    }

    const completedByHabit = new Map<string, Set<string>>();
    completions.forEach(({ habitGoalId, localDate }) => {
        const dates = completedByHabit.get(habitGoalId) || new Set<string>();
        dates.add(localDate);
        completedByHabit.set(habitGoalId, dates);
    });

    const totalDays = daysBetween(fromDate, upTo);
    for (let offset = 0; offset <= totalDays; offset += 1) {
        const localDate = addDays(fromDate, offset);
        const weekStart = getWeekStart(localDate);

        const isRequiredByAny = habits.some((habit) => {
            if (habit.startedOn && localDate < habit.startedOn) {
                return false;
            }
            if (habit.effectiveFrom && localDate < habit.effectiveFrom) {
                // The cadence on the row did not govern this day. Treat the day as not required
                // rather than guessing at a cadence we no longer hold — the alternative is
                // retroactively holding the user to rules that were not in force.
                return false;
            }

            const completed = completedByHabit.get(habit.habitGoalId);
            let earlierThisWeek = 0;
            if (completed && habit.cadence.kind === 'weeklyQuota') {
                for (let i = 0; i < DAYS_PER_WEEK; i += 1) {
                    const day = addDays(weekStart, i);
                    if (day >= localDate) {
                        break;
                    }
                    if (completed.has(day)) {
                        earlierThisWeek += 1;
                    }
                }
            }

            return isRequiredOn(habit.cadence, localDate, earlierThisWeek);
        });

        if (isRequiredByAny) {
            required.add(localDate);
        }
    }

    return required;
};

export interface IWeekProgress {
    /** Completed check-ins so far in the week containing the date. */
    done: number;
    /** What a full week calls for. */
    target: number;
    /** Days from the date through Sunday, inclusive. */
    daysLeft: number;
    /** Whether skipping the date would put the target out of reach. */
    isRequiredToday: boolean;
    /** Whether the week's obligation is already discharged. */
    isMet: boolean;
}

/**
 * The week's state as of `localDate`, for push copy and for the client's progress chip.
 * `completionsEarlierThisWeek` excludes `localDate` itself, the same convention as
 * `isRequiredOn`.
 */
export const describeWeekProgress = (
    cadence: Cadence,
    localDate: string,
    completionsEarlierThisWeek = 0,
): IWeekProgress => {
    const done = Math.max(0, completionsEarlierThisWeek);
    const target = getWeeklyTarget(cadence);
    return {
        done,
        target,
        daysLeft: isDateString(localDate) ? getDaysRemainingInWeek(localDate) : 0,
        isRequiredToday: isRequiredOn(cadence, localDate, done),
        isMet: done >= target,
    };
};
