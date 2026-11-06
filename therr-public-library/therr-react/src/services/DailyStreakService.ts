/* eslint-disable class-methods-use-this */
import axios from 'axios';

export type DailyStreakDayStatus = 'upheld' | 'frozen' | 'missed' | 'future' | 'pending';

export interface IDailyStreakWeekDay {
    date: string;
    /** 0 = Monday … 6 = Sunday. */
    dow: number;
    status: DailyStreakDayStatus;
    isToday: boolean;
}

export type DailyBonusTier = 'standard' | 'boosted' | 'comeback';
export type DailyBonusRarity = 'common' | 'rare' | 'epic' | 'jackpot';

/**
 * The day's bonus XP, rolled and paid server-side at the first check-in of the day — the user
 * has it whether or not they watch the celebration that reveals it.
 */
export interface IDailyBonus {
    tier: DailyBonusTier;
    rarity: DailyBonusRarity;
    bonusXp: number;
}

export interface IDailyStreakPendingCelebration {
    kind: 'day' | 'milestone';
    streak: number;
    isPerfectWeek: boolean;
    isNewLongest: boolean;
    /** Already paid; for the celebration to reveal. Absent on older servers, null when none. */
    dailyBonus?: IDailyBonus | null;
}

export interface IDailyStreakPendingPlacement {
    periodId: string;
    periodStart: string;
    periodEnd: string;
    placement: number;
    participants: number;
    score: number;
    /** Reserved for leagues; always null today. */
    leagueFrom: string | null;
    leagueTo: string | null;
}

export interface IDailyStreakSummary {
    currentStreak: number;
    longestStreak: number;
    today: string;
    timeZone: string;
    week: IDailyStreakWeekDay[];
    pendingCelebration: IDailyStreakPendingCelebration | null;
    pendingPlacements: IDailyStreakPendingPlacement[];
    /**
     * Whether today, left as it is, finalizes as a miss: a live streak, today not yet upheld,
     * and today required by the user's habit cadences. Optional because older servers omit it.
     */
    isAtStakeToday?: boolean;
}

/**
 * A day on the month calendar. Beyond the week strip's statuses: `rest` (nothing was required
 * that day — neither upheld nor broken) and `none` (a past day before the first check-in, or one
 * not evaluated yet — never a miss).
 */
export type DailyStreakCalendarDayStatus = 'upheld' | 'frozen' | 'missed' | 'rest' | 'pending' | 'future' | 'none';

export interface IDailyStreakCalendarDay {
    date: string;
    status: DailyStreakCalendarDayStatus;
    isToday: boolean;
}

export interface IDailyStreakCalendarFreezes {
    /** Freezes the daily streak can still spend, summed across every active habit. */
    remaining: number;
    /** Freezes ever earned across every active habit (spent + remaining). */
    total: number;
    /** Only habits that have earned at least one freeze. */
    habits: Array<{ habitGoalId: string; remaining: number; total: number }>;
}

export interface IDailyStreakCalendar {
    /** YYYY-MM actually returned — junk or a future month resolves to the current one. */
    month: string;
    today: string;
    timeZone: string;
    currentStreak: number;
    longestStreak: number;
    days: IDailyStreakCalendarDay[];
    freezesUsedThisMonth: number;
    /** The live pool, not as of `month`. */
    freezes: IDailyStreakCalendarFreezes;
    /** Whether any streak history predates `month`. */
    hasPreviousMonth: boolean;
}

/**
 * The app-level daily streak — one streak per user across every habit, in the user's own
 * timezone. Distinct from StreaksService, which is the per-habit streak.
 *
 * Whether a celebration is owed is decided by the server (`pendingCelebration`), never inferred
 * by the client, so two devices cannot both celebrate the same day.
 */
class DailyStreakService {
    /**
     * `timeZone` is the device's IANA zone. The server prefers the account's saved
     * `settingsTimezone` and only falls back to this, so sending it costs nothing and covers a
     * user who has not registered for push (which is what normally saves the zone).
     */
    getMine = (timeZone?: string) => {
        const params = new URLSearchParams();
        if (timeZone) params.append('timeZone', timeZone);
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/daily-streak/me${queryString}`,
        });
    };

    /**
     * One month of the daily streak ledger plus the live freeze pool, for the streak detail
     * screen. `month` is YYYY-MM; omitted, it is the user's current local month.
     */
    getCalendar = (month?: string, timeZone?: string) => {
        const params = new URLSearchParams();
        if (month) params.append('month', month);
        if (timeZone) params.append('timeZone', timeZone);
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/daily-streak/me/calendar${queryString}`,
        });
    };

    /**
     * Gate the next celebration: one per local day. `date` is the day that was celebrated.
     * `timeZone` is the device zone, the same fallback `getMine` sends: the server clamps `date`
     * to the user's local today and needs the zone to know which day that is.
     */
    markCelebrated = (date: string, timeZone?: string) => axios({
        method: 'post',
        url: '/users-service/habits/daily-streak/me/celebrated',
        data: timeZone ? { date, timeZone } : { date },
    });

    /** Dismiss an end-of-period leaderboard placement. `periodId` is the period's start date. */
    acknowledgePlacement = (periodId: string) => axios({
        method: 'post',
        url: `/users-service/users/leaderboards/periods/${periodId}/acknowledge`,
    });
}

export default new DailyStreakService();
