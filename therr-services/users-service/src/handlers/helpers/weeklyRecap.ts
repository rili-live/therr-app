/**
 * Weekly recap — the loading half. The rules are in utilities/weeklyRecap.ts.
 *
 * Reads only. Nothing here writes, evaluates streaks or advances a phase: the
 * recap is a view over what `evaluateAllDailyStreaks` has already decided, and a
 * read that silently mutated a user's streak would make opening the screen have
 * side effects.
 *
 * The one consequence worth stating: a user whose ledger has not been finalized
 * through the end of the recap week sees that tail as missed days. That does not
 * happen for the notification path — the digest evaluates every user's streak
 * before the recap pass runs (see runDailyHabitsDigest) — and for a direct read
 * of the *current* week it is correct anyway, since a day nobody has upheld yet
 * is not upheld.
 */

import Store from '../../store';
import {
    addDays,
    getLocalDate,
    getWeekEnd,
    resolveCheckinTimeZone,
} from '../../utilities/dailyStreak';
import {
    assembleWeeklyRecap,
    buildRecapDays,
    sumRecapTotals,
    IWeeklyRecap,
    IWeeklyRecapHabit,
    WeeklyRecapDayStatus,
} from '../../utilities/weeklyRecap';

const statusMapFor = (rows: { localDate: string; status: WeeklyRecapDayStatus }[]): Map<string, WeeklyRecapDayStatus> => {
    const byDate = new Map<string, WeeklyRecapDayStatus>();
    rows.forEach((row) => byDate.set(row.localDate, row.status));
    return byDate;
};

export interface IBuildWeeklyRecapArgs {
    userId: string;
    weekStartDate: string;
    settingsTimezone?: unknown;
    deviceTimezone?: unknown;
    /** Overrides the resolved zone. The digest already knows it and re-deriving would be a second lookup. */
    timeZone?: string;
    now?: Date;
}

/**
 * Load one user's recap for one week.
 *
 * Six reads, all bounded by a 14-day date range and all against the read pool.
 * The previous week is fetched in the same round trip as this one — the ledger
 * and the check-in counts are both range queries, so widening the range costs
 * one index scan rather than a second query, and the comparison is the whole
 * point of the recap.
 */
export const buildWeeklyRecap = async ({
    userId,
    weekStartDate,
    settingsTimezone,
    deviceTimezone,
    timeZone: providedTimeZone,
    now = new Date(),
}: IBuildWeeklyRecapArgs): Promise<IWeeklyRecap> => {
    const timeZone = providedTimeZone || resolveCheckinTimeZone(settingsTimezone, deviceTimezone);
    const today = getLocalDate(timeZone, now);

    const weekEndDate = getWeekEnd(weekStartDate);
    const previousWeekStartDate = addDays(weekStartDate, -7);
    const previousWeekEndDate = addDays(weekStartDate, -1);

    const [
        ledgerRows,
        checkinCountsByDate,
        habitRows,
        streakState,
    ] = await Promise.all([
        Store.dailyStreakDays.getRange(userId, previousWeekStartDate, weekEndDate),
        Store.habitCheckins.getCompletedCountsByLocalDate(userId, previousWeekStartDate, weekEndDate),
        Store.habitCheckins.getCompletedCountsByHabitForLocalRange(userId, weekStartDate, weekEndDate),
        Store.userDailyStreaks.getOrCreate(userId),
    ]);

    const statusByDate = statusMapFor(ledgerRows);

    // A closed week is rendered in full; the week in progress stops at today.
    // `upTo` is the earlier of the week's Sunday and the user's today.
    const upTo = weekEndDate > today ? today : weekEndDate;

    const days = buildRecapDays({
        weekStartDate, upTo, statusByDate, checkinCountByDate: checkinCountsByDate,
    });
    const previousDays = buildRecapDays({
        weekStartDate: previousWeekStartDate,
        upTo: previousWeekEndDate,
        statusByDate,
        checkinCountByDate: checkinCountsByDate,
    });

    // "Had a previous week" means the ledger or the check-ins say something
    // happened, not merely that the dates exist. Without this a brand-new user's
    // first recap would compare against seven fabricated missed days and report
    // an improvement they did not earn.
    const previousTotals = sumRecapTotals(previousDays);
    const hasPreviousWeek = previousDays.some((day) => day.checkinCount > 0 || statusByDate.has(day.date));

    const habits: IWeeklyRecapHabit[] = habitRows.map((row) => ({
        habitGoalId: row.habitGoalId,
        name: row.name,
        emoji: row.emoji,
        completedCount: row.completedCount,
    }));

    // The streak as it stood when the week closed, read off the ledger rather
    // than off `user_daily_streaks.currentStreak` — that column is live, so for
    // a recap of a week that ended days ago it answers a different question.
    const lastDayOfWeek = days[days.length - 1];
    const streakAtWeekEnd = lastDayOfWeek
        ? (ledgerRows.find((row) => row.localDate === lastDayOfWeek.date)?.streakAfter ?? 0)
        : 0;

    return assembleWeeklyRecap({
        weekStartDate,
        timeZone,
        today,
        days,
        previousTotals,
        hasPreviousWeek,
        habits,
        streakAtWeekEnd,
        longestStreak: streakState.longestStreak,
    });
};
