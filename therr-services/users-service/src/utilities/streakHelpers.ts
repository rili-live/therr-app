/**
 * Streak calculation and milestone utilities for the HABITS app
 */

// Standard milestone thresholds
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365];

/**
 * Check if a streak count has reached a milestone
 */
export const checkMilestoneReached = (streakCount: number): number | null => {
    // Return the exact milestone if the streak matches one
    if (STREAK_MILESTONES.includes(streakCount)) {
        return streakCount;
    }
    return null;
};

/**
 * Get the next milestone for a given streak count
 */
export const getNextMilestone = (currentStreak: number): number | null => {
    const nextMilestone = STREAK_MILESTONES.find((milestone) => milestone > currentStreak);
    return nextMilestone || null;
};

/**
 * Get progress percentage towards next milestone
 */
export const getMilestoneProgress = (currentStreak: number): { nextMilestone: number | null; progress: number } => {
    const nextMilestone = getNextMilestone(currentStreak);
    if (!nextMilestone) {
        return { nextMilestone: null, progress: 100 };
    }

    // Find previous milestone
    const prevMilestoneIndex = STREAK_MILESTONES.findIndex((m) => m > currentStreak) - 1;
    const prevMilestone = prevMilestoneIndex >= 0 ? STREAK_MILESTONES[prevMilestoneIndex] : 0;

    const range = nextMilestone - prevMilestone;
    const progressInRange = currentStreak - prevMilestone;
    const progress = Math.round((progressInRange / range) * 100);

    return { nextMilestone, progress };
};

/**
 * Parse any accepted date value to local midnight of the calendar date it
 * represents. Date-only strings (YYYY-MM-DD) are treated as that calendar
 * date rather than UTC midnight: `new Date('2026-07-22')` parses as UTC
 * midnight, so in any timezone west of UTC it lands on the evening of Jul 21
 * local, and `.setHours(0,0,0,0)` then snaps it to Jul 21 — every date-only
 * value silently shifts back a day and streak-gap math is off by one. Date
 * objects and full datetime strings keep their local calendar date, matching
 * the convention in normalizeDateString.
 */
const toLocalMidnight = (value: string | Date): Date => {
    if (typeof value === 'string') {
        const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (dateOnlyMatch) {
            const [, year, month, day] = dateOnlyMatch;
            return new Date(Number(year), Number(month) - 1, Number(day));
        }
    }
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
};

/**
 * Whole days between two dates (date-only comparison; positive when `later`
 * is after `earlier`). Accepts date strings or Date objects.
 */
export const getDaysBetweenDates = (earlier: string | Date, later: string | Date): number => {
    const a = toLocalMidnight(earlier);
    const b = toLocalMidnight(later);
    return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Normalize a date value (Date or ISO/date string) to YYYY-MM-DD for
 * comparison against checkin scheduledDate strings.
 */
export const normalizeDateString = (date: string | Date): string => {
    const d = toLocalMidnight(date);
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
};

/**
 * `countMissedDaysForStreak` lived here and has moved to `countMissedPeriods` in
 * utilities/habitCadence.ts, along with `wasDayMissed` and `canUseGracePeriod` (both of which had
 * no callers and each held a *different* copy of the cadence rules).
 *
 * It was not a like-for-like move. The old function ignored `frequencyCount` entirely and honoured
 * `targetDaysOfWeek` only when `frequencyType === 'weekly'`, so a `custom` goal with fixed days
 * was nudged on those days and scored for streak-breaking against all seven; and its bare-weekly
 * branch (`Math.floor(daysDiff / 7) > 1`) made an N-per-week streak effectively unbreakable. The
 * replacement judges a quota by whole closed weeks, which needs the week's completed dates rather
 * than just the gap endpoints — hence the wider argument shape at the call sites.
 */

/**
 * Maximum earnable streak freezes (grace days). New streaks start with 1;
 * each 7+ day milestone earns one more, capped here.
 */
export const MAX_GRACE_PERIOD_DAYS = 3;

/**
 * Format streak for display
 */
export const formatStreakDisplay = (streakCount: number): string => {
    if (streakCount === 0) {
        return 'No streak';
    }
    if (streakCount === 1) {
        return '1 day';
    }
    return `${streakCount} days`;
};

/**
 * Get streak status emoji based on count
 */
export const getStreakEmoji = (streakCount: number): string => {
    if (streakCount >= 365) return '🏆';
    if (streakCount >= 180) return '⭐';
    if (streakCount >= 90) return '💎';
    if (streakCount >= 60) return '🌟';
    if (streakCount >= 30) return '🔥';
    if (streakCount >= 14) return '💪';
    if (streakCount >= 7) return '✨';
    if (streakCount >= 3) return '👍';
    return '🌱';
};

/**
 * Calculate streak risk level (for notifications)
 * Returns: 'safe' | 'at_risk' | 'critical'
 */
export const getStreakRiskLevel = (
    lastCompletedDate: string | null,
    frequencyType: string,
): 'safe' | 'at_risk' | 'critical' => {
    if (!lastCompletedDate) {
        return 'safe';
    }

    const now = new Date();
    const lastCompleted = new Date(lastCompletedDate);
    const hoursSinceCompletion = (now.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60);

    if (frequencyType === 'daily') {
        if (hoursSinceCompletion >= 36) return 'critical'; // Less than 12 hours until midnight
        if (hoursSinceCompletion >= 20) return 'at_risk'; // Evening of the next day
        return 'safe';
    }

    // For non-daily habits, use more relaxed thresholds
    if (hoursSinceCompletion >= 144) return 'critical'; // 6 days
    if (hoursSinceCompletion >= 120) return 'at_risk'; // 5 days
    return 'safe';
};

/**
 * Today in UTC, YYYY-MM-DD.
 *
 * **Not a habit day.** A habit day is the user's own calendar day — see
 * `resolveCheckinHabitDate` in `utilities/dailyStreak.ts`, which is what the check-in write
 * path stamps on `scheduledDate` and what every per-user read of "today" has to match. This
 * used to be that definition, and the gap is exactly why a 19:00 check-in in Chicago landed on
 * tomorrow.
 *
 * Only use it where there is genuinely no user to resolve a zone for: a service-wide job
 * boundary, or a log line. For anything a user will see, resolve their zone
 * (`resolveCheckinTimeZone`) and call `getLocalDate`.
 *
 * `getYesterdayDateString`, `isToday` and `isYesterday` used to sit alongside this and were
 * deleted rather than fixed: nothing called them, and an unqualified `isToday(date)` is the
 * shape of this bug waiting to be reintroduced.
 */
export const getTodayDateString = (): string => new Date().toISOString().split('T')[0];

/**
 * Whether a streak update represents a "comeback" — i.e. the user just restarted a streak
 * after a previous one ended. previousLongestStreak must be > 0 so the very first streak
 * does not trip a Bounce Back.
 */
export const isComebackStart = (
    streakBefore: number,
    streakAfter: number,
    previousLongestStreak: number,
): boolean => streakBefore === 0 && streakAfter === 1 && previousLongestStreak > 0;

/**
 * Whether the user just beat their previous longest streak (Phoenix moment).
 * Guarded so the first ever streak does not count — previous record must have been at least 7.
 */
export const isPhoenixMoment = (
    streakAfter: number,
    previousLongestStreak: number,
): boolean => streakAfter > previousLongestStreak && previousLongestStreak >= 7;

/**
 * Is this habit due today?
 *
 * The gate on the daily reminder. Without it a "3x per week" habit gets nudged
 * seven days a week, which is the single fastest way to teach a user that the
 * app's reminders are noise — the anti-pattern
 * docs/PUSH_NOTIFICATIONS_ENGAGEMENT_ROADMAP.md warns costs DAU rather than
 * lifting it.
 *
 * Three cadence shapes, in priority order:
 *
 *   1. `targetDaysOfWeek` set → due only on those weekdays, whatever
 *      `frequencyType` says. An explicit schedule is the strongest signal the
 *      user has given us and always wins.
 *   2. `daily` → due every day.
 *   3. Everything else (a `weekly`/`custom` count with no fixed days) → there
 *      is no day to anchor on, so "due" is derived from the gap since the last
 *      completion: a 3x/week habit is due once roughly every other day. This
 *      reads `lastCompletedDate` off the streak row the caller already has
 *      rather than counting check-ins, so it costs no extra query.
 *
 * `today` is a YYYY-MM-DD string and is parsed as UTC, matching
 * `getTodayDateString()` and the UTC convention in habitLifecycleContext. Using
 * local parsing here would put the weekday one day off for every host west of
 * UTC — see the note on `toLocalMidnight` above for the same hazard.
 */
export const isHabitDueToday = (
    habit: {
        frequencyType?: string | null;
        frequencyCount?: number | null;
        targetDaysOfWeek?: number[] | null;
        lastCompletedDate?: string | Date | null;
    },
    today: string,
): boolean => {
    const todayUtc = new Date(`${String(today).slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(todayUtc.getTime())) {
        // An unparseable date is a bug in the caller, not a reason to spam. Stay
        // silent rather than reminding on a day we cannot identify.
        return false;
    }

    if (habit.targetDaysOfWeek?.length) {
        return habit.targetDaysOfWeek.includes(todayUtc.getUTCDay());
    }

    const frequencyType = habit.frequencyType || 'daily';
    if (frequencyType === 'daily') {
        return true;
    }

    // Never completed → due now. This is deliberately the permissive branch: a
    // habit someone set up and never started is exactly who a reminder is for.
    if (!habit.lastCompletedDate) {
        return true;
    }

    // Clamped into 1..7. A malformed frequencyCount (0, null, negative, NaN)
    // therefore degrades to once a week — the quiet direction. Leaving it
    // unclamped would either divide by zero or produce an interval so large the
    // habit is never reminded again, and both are silent failures; over-
    // reminding on bad data would at least be visible, but it is visible to the
    // user, as spam.
    const perWeek = Math.max(1, Math.min(7, Number(habit.frequencyCount) || 1));
    const intervalDays = Math.max(1, Math.floor(7 / perWeek));
    const lastCompletedUtc = new Date(
        `${normalizeDateString(habit.lastCompletedDate).slice(0, 10)}T00:00:00.000Z`,
    );
    if (Number.isNaN(lastCompletedUtc.getTime())) {
        return true;
    }

    const daysSince = Math.floor(
        (todayUtc.getTime() - lastCompletedUtc.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysSince >= intervalDays;
};
