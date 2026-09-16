/* eslint-disable class-methods-use-this */
import axios from 'axios';

export type WeeklyRecapDayStatus = 'upheld' | 'frozen' | 'missed';

/**
 * Which story the week tells. Decided by the server (users-service
 * `pickWeeklyRecapHeadline`) so the push notification's body and the screen's
 * header cannot contradict each other — never re-derived on the client from the
 * totals below.
 */
export type WeeklyRecapHeadline = 'perfectWeek' | 'firstWeek' | 'improved' | 'steady' | 'declined';

export interface IWeeklyRecapDay {
    date: string;
    /** 0 = Monday … 6 = Sunday, matching the daily-streak strip. */
    dow: number;
    status: WeeklyRecapDayStatus;
    checkinCount: number;
}

export interface IWeeklyRecapHabit {
    habitGoalId: string;
    name: string;
    emoji: string | null;
    completedCount: number;
}

export interface IWeeklyRecapTotals {
    checkinCount: number;
    upheldDays: number;
    /** Days a streak freeze covered: the streak survived, the day was not earned. */
    frozenDays: number;
    missedDays: number;
}

export interface IWeeklyRecap {
    weekStartDate: string;
    weekEndDate: string;
    timeZone: string;
    /** True for the week still in progress, whose `days` stop at today rather than running to Sunday. */
    isCurrentWeek: boolean;
    days: IWeeklyRecapDay[];
    totals: IWeeklyRecapTotals;
    previousTotals: IWeeklyRecapTotals;
    /** False when there is no earlier week to compare against — do not render a comparison. */
    hasPreviousWeek: boolean;
    /** Busiest habit first. Empty for a week with no completed check-ins. */
    habits: IWeeklyRecapHabit[];
    topHabit: IWeeklyRecapHabit | null;
    streakAtWeekEnd: number;
    longestStreak: number;
    isPerfectWeek: boolean;
    headline: WeeklyRecapHeadline;
}

/**
 * One Monday–Sunday week of habit activity, in the user's own timezone.
 *
 * A read model over the same ledger `DailyStreakService` reads, so the two agree
 * about which days belong to which week. Nothing here writes.
 */
class WeeklyRecapService {
    /**
     * `weekStart` may be any date inside the wanted week — the server normalizes it to that
     * week's Monday, so a notification payload's `weekStartDate` and a date the user picked off
     * the strip both work. Omit it for the most recently *closed* week, which is what a
     * notification tap means.
     *
     * `timeZone` is the device's IANA zone, used only when the account has no saved
     * `settingsTimezone` — same precedence as `DailyStreakService.getMine`.
     */
    getMine = (weekStart?: string, timeZone?: string) => {
        const params = new URLSearchParams();
        if (weekStart) params.append('weekStart', weekStart);
        if (timeZone) params.append('timeZone', timeZone);
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/weekly-recap/me${queryString}`,
        });
    };
}

export default new WeeklyRecapService();
