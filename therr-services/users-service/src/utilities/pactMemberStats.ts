/**
 * Pact progress statistics — derived, not denormalized.
 *
 * `habits.pact_members` carries stat columns (totalCheckins, completedCheckins,
 * currentStreak, longestStreak, completionRate) but they are only ever written
 * from the check-in handler's `if (pactId)` branch, and no client sends a
 * `pactId` when checking in — a check-in is logged against a habit goal, and
 * the goal is what a pact is built on. So those columns sit at their table
 * defaults (0 / NULL) forever and the progress-comparison card renders empty.
 *
 * They are also structurally unable to hold a real completion rate: the
 * increment only runs for *completed* check-ins and bumps `totalCheckins` and
 * `completedCheckins` together, so the ratio is always 100%.
 *
 * These helpers derive the same numbers from the source-of-truth tables
 * (`habits.streaks` and `habits.habit_checkins`) keyed on (userId, habitGoalId)
 * over the pact's own date window. That reads correctly for pacts already in
 * flight without a backfill, and without a client release.
 */
import { normalizeDateString } from './streakHelpers';
import { getCadence, countScheduledForRange } from './habitCadence';
import { getLocalDate } from './dailyStreak';
import { FALLBACK_TIME_ZONE } from './localReminderSchedule';

export interface IPactStatsWindow {
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
}

export interface IPactStatsGoal {
    frequencyType?: string;
    frequencyCount?: number;
    targetDaysOfWeek?: number[] | null;
}

export interface IPactMemberStats {
    totalCheckins: number;
    completedCheckins: number;
    currentStreak: number;
    longestStreak: number;
    completionRate: number;
    /**
     * Whether this member has a completed check-in for the pact's habit goal
     * **today**, on the service's UTC habit day.
     *
     * A statement about the member's habit, not about the pact: it stays
     * factual for a pact that has already ended, and the caller decides
     * whether showing it makes sense there. Pacts with no measurable window
     * (pending, or not yet started) report `false` along with every other
     * zeroed stat — there is nothing to be late for yet.
     */
    checkedInToday: boolean;
}

export const ZERO_PACT_MEMBER_STATS: IPactMemberStats = {
    totalCheckins: 0,
    completedCheckins: 0,
    currentStreak: 0,
    longestStreak: 0,
    completionRate: 0,
    checkedInToday: false,
};

/**
 * The date range a pact's progress is measured over, clamped to today so an
 * in-flight pact isn't scored against days that haven't happened yet.
 *
 * Returns null when there is nothing to measure: a pending pact has no
 * startDate, and a pact scheduled to start later has no elapsed days.
 */
export const getPactStatsWindow = (
    pact: { startDate?: string | Date | null; endDate?: string | Date | null } | null | undefined,
    // A pact is a group, so its window cannot be resolved in one member's zone the way
    // "did *you* check in today?" can. The service fallback zone is the closest available
    // stand-in and the one every other unattributable habits decision already uses; UTC would
    // extend the denominator into a day that has not started yet for the whole Americas, and
    // dip everyone's completion rate every evening.
    today: string = getLocalDate(FALLBACK_TIME_ZONE),
): IPactStatsWindow | null => {
    if (!pact?.startDate) {
        return null;
    }

    const startDate = normalizeDateString(pact.startDate);
    if (startDate > today) {
        return null;
    }

    // An abandoned/expired pact keeps its endDate; a pact whose endDate is
    // somehow missing is measured through today.
    const pactEndDate = pact.endDate ? normalizeDateString(pact.endDate) : today;
    const endDate = pactEndDate < today ? pactEndDate : today;

    return endDate < startDate ? null : { startDate, endDate };
};

/**
 * How many check-ins the habit's cadence called for across an inclusive date
 * range. This is the denominator of the completion rate — counting only the
 * check-in rows that exist would make every rate 100%.
 */
export const countScheduledCheckins = (
    startDate: string,
    endDate: string,
    goal?: IPactStatsGoal | null,
): number => countScheduledForRange(getCadence(goal), startDate, endDate);

/**
 * Assemble one member's stats. `completedCheckins` is a count of completed
 * check-in rows inside the pact window; `streak` is the member's streak row
 * for the pact's habit goal (streaks are per user+goal, so a member who was
 * already building the habit solo keeps that streak when they join a pact).
 */
export const buildPactMemberStats = ({
    scheduledCount,
    completedCheckins,
    streak,
    checkedInToday = false,
}: {
    scheduledCount: number;
    completedCheckins: number;
    streak?: { currentStreak?: number | string; longestStreak?: number | string } | null;
    checkedInToday?: boolean;
}): IPactMemberStats => {
    const completed = Math.max(0, Math.round(Number(completedCheckins) || 0));
    // A user can log more check-ins than the cadence schedules (a 3x/week
    // habit done daily), so widen the denominator rather than report >100%.
    const totalCheckins = Math.max(Math.max(0, scheduledCount), completed);
    const completionRate = totalCheckins > 0
        ? Math.round((completed / totalCheckins) * 10000) / 100
        : 0;

    return {
        totalCheckins,
        completedCheckins: completed,
        currentStreak: Number(streak?.currentStreak) || 0,
        longestStreak: Number(streak?.longestStreak) || 0,
        completionRate,
        checkedInToday,
    };
};
