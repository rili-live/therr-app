import { addDays, DailyStreakDayStatus } from './dailyStreak';

/**
 * Pure rules for the daily streak's month calendar (`GET /habits/daily-streak/me/calendar`).
 *
 * The ledger (`habits.daily_streak_days`) holds one row per finalized local day from the user's
 * first check-in on, so a month is read as "the ledger rows that fall in it", plus three
 * statuses the ledger cannot hold:
 *
 * - `pending` — today, not yet upheld. It finalizes tonight; it is not a miss yet.
 * - `future`  — after today.
 * - `none`    — a past day with no ledger row: before the user's first check-in, or a day the
 *               evaluator has not reached. Rendered as a plain date, never as a miss. This is
 *               where the month view deliberately differs from `buildWeek`, which reads a
 *               missing past day as `missed` — fine for this week's strip, wrong for a month
 *               that can reach back before the user existed.
 */
export type StreakCalendarDayStatus = DailyStreakDayStatus | 'pending' | 'future' | 'none';

export interface IStreakCalendarDay {
    date: string;
    status: StreakCalendarDayStatus;
    isToday: boolean;
}

export interface IStreakCalendarRow {
    localDate: string;
    status: DailyStreakDayStatus;
}

export interface IFreezeStreakRow {
    habitGoalId: string;
    gracePeriodDays?: number | string | null;
    graceDaysUsed?: number | string | null;
    isActive?: boolean | null;
}

export interface IStreakCalendarHabitFreezes {
    habitGoalId: string;
    remaining: number;
    total: number;
}

export interface IStreakCalendarFreezes {
    /** Freezes the daily streak can still spend, summed across every active habit. */
    remaining: number;
    /** Freezes ever earned across every active habit (spent + remaining). */
    total: number;
    /** Only habits that have earned at least one freeze. */
    habits: IStreakCalendarHabitFreezes[];
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isMonthString = (value: unknown): value is string => typeof value === 'string' && MONTH_PATTERN.test(value);

/**
 * The month the caller asked for, as YYYY-MM. Junk, or a month after today's, resolves to
 * today's month rather than answering 400 — a calendar that opens on this month is strictly
 * better than one that refuses to open (the same choice `resolveRequestedWeekStart` makes).
 */
export const resolveRequestedMonth = (value: unknown, today: string): string => {
    const currentMonth = today.slice(0, 7);
    if (!isMonthString(value) || value > currentMonth) {
        return currentMonth;
    }
    return value;
};

export const getDaysInMonth = (month: string): number => {
    const [year, monthNumber] = month.split('-').map(Number);
    // Day 0 of the next month is the last day of this one.
    return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
};

export const getMonthBounds = (month: string): { start: string; end: string } => {
    const start = `${month}-01`;
    return { start, end: addDays(start, getDaysInMonth(month) - 1) };
};

export const buildMonthDays = (month: string, today: string, rows: IStreakCalendarRow[]): IStreakCalendarDay[] => {
    const byDate = new Map<string, DailyStreakDayStatus>();
    rows.forEach((row) => byDate.set(row.localDate, row.status));
    const { start } = getMonthBounds(month);

    return Array.from({ length: getDaysInMonth(month) }, (_, index) => {
        const date = addDays(start, index);
        const isToday = date === today;
        let status: StreakCalendarDayStatus;
        if (date > today) {
            status = 'future';
        } else if (byDate.has(date)) {
            status = byDate.get(date) as DailyStreakDayStatus;
        } else {
            status = isToday ? 'pending' : 'none';
        }
        return { date, status, isToday };
    });
};

export const countFrozenDays = (days: IStreakCalendarDay[]): number => days
    .filter((day) => day.status === 'frozen').length;

/**
 * The freeze pool the daily streak borrows from: every active habit's `gracePeriodDays -
 * graceDaysUsed`, the same rule as `loadFreezeSources` in the evaluator, so the number on the
 * calendar is the number the next missed day will actually draw on.
 */
export const summarizeFreezes = (streaks: IFreezeStreakRow[]): IStreakCalendarFreezes => {
    const habits = (streaks || [])
        .filter((streak) => streak.isActive !== false)
        .map((streak) => {
            const total = Math.max(0, Number(streak.gracePeriodDays) || 0);
            const used = Math.max(0, Number(streak.graceDaysUsed) || 0);
            return {
                habitGoalId: streak.habitGoalId,
                remaining: Math.max(0, total - used),
                total,
            };
        })
        .filter((habit) => habit.total > 0);

    return {
        remaining: habits.reduce((sum, habit) => sum + habit.remaining, 0),
        total: habits.reduce((sum, habit) => sum + habit.total, 0),
        habits,
    };
};
