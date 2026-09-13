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

export interface IDailyStreakPendingCelebration {
    kind: 'day' | 'milestone';
    streak: number;
    isPerfectWeek: boolean;
    isNewLongest: boolean;
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
