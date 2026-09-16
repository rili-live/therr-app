/**
 * Weekly recap — the pure rules. No I/O; the queries that feed it live in
 * handlers/helpers/weeklyRecap.ts and the screen that renders it lives on
 * niche/HABITS-general.
 *
 * ## What a recap is
 *
 * One Monday–Sunday week of the app-level daily streak, told back to the user:
 * which days they upheld, how many check-ins they logged, which habit carried
 * the week, and how all of that compares with the week before.
 *
 * The week is the *user's* local week, computed from `habit_checkins.localDate`
 * and the `habits.daily_streak_days` ledger — the same two sources the daily
 * streak reads (see utilities/dailyStreak.ts). It is deliberately not the UTC
 * week: a Sunday-evening check-in in Chicago is already Monday in UTC, and a
 * recap that moves that check-in into the following week contradicts the streak
 * strip the user is looking at on the dashboard.
 *
 * ## Why the week boundary is Monday
 *
 * `getWeekStart` / `getWeekEnd` in utilities/dailyStreak.ts are Monday-first,
 * the perfect-week rule is Monday–Sunday, and the leaderboard period closes on
 * the same boundary. A recap on a different boundary would disagree with all
 * three for no gain, so this module re-uses those helpers rather than restating
 * the arithmetic.
 *
 * ## Why the headline is decided here
 *
 * The push body and the screen's header must say the same thing. They are built
 * in different services from different code paths — push copy in
 * push-notifications-service, screen copy on the mobile branch — so the *choice*
 * of what to say is made once, here, and travels as a single string. Letting
 * each side pick its own framing from the raw numbers is how a push that says
 * "your best week yet" opens a screen that says "steady week".
 */

import {
    addDays,
    daysBetween,
    getWeekEnd,
    getWeekStart,
    isDateString,
} from './dailyStreak';
import type { DailyStreakDayStatus } from './dailyStreak';

export type WeeklyRecapDayStatus = DailyStreakDayStatus;

/**
 * Which story the recap tells. Ordered by precedence in `pickWeeklyRecapHeadline`,
 * not by sentiment.
 *
 * `firstWeek` exists because every comparison-based headline is a lie for
 * someone with no previous week: "up 4 check-ins" against a week they were not
 * yet a user is technically true and reads as manufactured praise.
 */
export type WeeklyRecapHeadline =
    | 'perfectWeek'
    | 'firstWeek'
    | 'improved'
    | 'steady'
    | 'declined';

export interface IWeeklyRecapDay {
    /** YYYY-MM-DD, in the user's own zone. */
    date: string;
    /** 0 = Monday … 6 = Sunday, matching the daily streak strip. */
    dow: number;
    status: WeeklyRecapDayStatus;
    /** Completed check-ins across every habit on that day. */
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
    /** Days a streak freeze covered. Counted separately: the streak survived, the day was not earned. */
    frozenDays: number;
    missedDays: number;
}

export interface IWeeklyRecap {
    weekStartDate: string;
    weekEndDate: string;
    timeZone: string;
    /**
     * True when the requested week is the one still in progress. The screen may
     * render it; the notification never recaps it.
     */
    isCurrentWeek: boolean;
    days: IWeeklyRecapDay[];
    totals: IWeeklyRecapTotals;
    /** The week before. All zeros when the user has no history that far back — see `hasPreviousWeek`. */
    previousTotals: IWeeklyRecapTotals;
    hasPreviousWeek: boolean;
    /** Busiest habit first, then alphabetical so the order is stable between two equal counts. */
    habits: IWeeklyRecapHabit[];
    topHabit: IWeeklyRecapHabit | null;
    /** The daily streak as of the last day of this week. */
    streakAtWeekEnd: number;
    longestStreak: number;
    isPerfectWeek: boolean;
    headline: WeeklyRecapHeadline;
}

export const EMPTY_WEEKLY_RECAP_TOTALS: IWeeklyRecapTotals = {
    checkinCount: 0,
    upheldDays: 0,
    frozenDays: 0,
    missedDays: 0,
};

/**
 * The Monday of the week a recap sent on `localDate` is about: the week that has
 * just closed, i.e. the one before the week containing `localDate`.
 *
 * Called with the user's local today on the day the digest decides. On a Monday
 * that is last week; on any other day it is still last week, which is what makes
 * the dedupe key safe to compute on every run — a second run on Wednesday
 * resolves to the same key the Monday run already inserted.
 */
export const getRecapWeekStart = (localDate: string): string => addDays(getWeekStart(localDate), -7);

/** The dedupe key for one user's recap of one week. Period-stamped, no clock, no random value. */
export const weeklyRecapDedupeKey = (weekStartDate: string): string => `weekly-recap:${weekStartDate}`;

/**
 * Whether `localDate` is the day a recap for the just-closed week should go out.
 *
 * Monday, in the user's own zone. The digest runs once a day at a single UTC
 * instant, so every zone gets its own Monday as that instant sweeps across them;
 * nothing here buckets by timezone.
 */
export const isRecapDay = (localDate: string): boolean => getWeekStart(localDate) === localDate;

export const sumRecapTotals = (
    days: IWeeklyRecapDay[],
): IWeeklyRecapTotals => days.reduce((totals, day) => ({
    checkinCount: totals.checkinCount + day.checkinCount,
    upheldDays: totals.upheldDays + (day.status === 'upheld' ? 1 : 0),
    frozenDays: totals.frozenDays + (day.status === 'frozen' ? 1 : 0),
    missedDays: totals.missedDays + (day.status === 'missed' ? 1 : 0),
}), { ...EMPTY_WEEKLY_RECAP_TOTALS });

/**
 * Build the seven (or fewer) days of a recap week.
 *
 * `upTo` bounds the week for the in-progress case: a week is rendered only as
 * far as the user has lived it, so the current week shows four days rather than
 * three "missed" ones the user has not reached yet. A closed week passes its own
 * Sunday and gets all seven.
 *
 * A day absent from the ledger is `missed`, matching `buildWeek` in
 * handlers/helpers/dailyStreak.ts: the evaluator writes a row for every day it
 * walks, so a gap means the day was never upheld.
 */
export const buildRecapDays = ({
    weekStartDate,
    upTo,
    statusByDate,
    checkinCountByDate,
}: {
    weekStartDate: string;
    upTo: string;
    statusByDate: Map<string, WeeklyRecapDayStatus>;
    checkinCountByDate: Map<string, number>;
}): IWeeklyRecapDay[] => {
    const days: IWeeklyRecapDay[] = [];

    for (let dow = 0; dow < 7; dow += 1) {
        const date = addDays(weekStartDate, dow);
        if (daysBetween(date, upTo) < 0) {
            break;
        }
        days.push({
            date,
            dow,
            status: statusByDate.get(date) || 'missed',
            checkinCount: checkinCountByDate.get(date) || 0,
        });
    }

    return days;
};

/**
 * Busiest habit first. Ties break on name so two habits with the same count do
 * not swap places between the push (built at queue-drain time) and the screen
 * (built when the user taps), which would make the "top habit" the copy names
 * disagree with the row at the top of the list.
 */
export const rankRecapHabits = (habits: IWeeklyRecapHabit[]): IWeeklyRecapHabit[] => [...habits]
    .filter((habit) => habit.completedCount > 0)
    .sort((a, b) => (b.completedCount - a.completedCount) || a.name.localeCompare(b.name));

/**
 * Which story to tell, in precedence order:
 *
 *   1. `perfectWeek` — seven upheld days, no freezes. Earned outright and beats
 *      every comparison; a perfect week that happens to be one check-in down on
 *      the last one is still a perfect week.
 *   2. `firstWeek` — no previous week to compare against.
 *   3. `improved` / `declined` — more or fewer check-ins than last week.
 *   4. `steady` — the same number, which is its own kind of good and is the
 *      honest thing to say when nothing moved.
 *
 * Deliberately compares check-ins rather than upheld days: upheld days saturate
 * at seven, so a user who went from one habit a day to three would read
 * "steady" every week after their first full one.
 */
export const pickWeeklyRecapHeadline = ({
    totals,
    previousTotals,
    hasPreviousWeek,
    isPerfectWeek,
}: {
    totals: IWeeklyRecapTotals;
    previousTotals: IWeeklyRecapTotals;
    hasPreviousWeek: boolean;
    isPerfectWeek: boolean;
}): WeeklyRecapHeadline => {
    if (isPerfectWeek) {
        return 'perfectWeek';
    }
    if (!hasPreviousWeek) {
        return 'firstWeek';
    }
    if (totals.checkinCount > previousTotals.checkinCount) {
        return 'improved';
    }
    if (totals.checkinCount < previousTotals.checkinCount) {
        return 'declined';
    }
    return 'steady';
};

/**
 * A week is perfect only when every one of its seven days was upheld by a real
 * check-in. A frozen day keeps the streak alive and is explicitly not perfect —
 * same rule as `walkDailyStreakDays`, which is what makes the recap's verdict
 * and the perfect-week achievement agree.
 */
export const isPerfectRecapWeek = (days: IWeeklyRecapDay[]): boolean => days.length === 7
    && days.every((day) => day.status === 'upheld');

export interface IAssembleWeeklyRecapArgs {
    weekStartDate: string;
    timeZone: string;
    /** The user's local today, used to decide whether this week is still open. */
    today: string;
    days: IWeeklyRecapDay[];
    previousTotals: IWeeklyRecapTotals;
    hasPreviousWeek: boolean;
    habits: IWeeklyRecapHabit[];
    streakAtWeekEnd: number;
    longestStreak: number;
}

/** Fold the loaded pieces into the shape the API returns and the notification reads. */
export const assembleWeeklyRecap = ({
    weekStartDate,
    timeZone,
    today,
    days,
    previousTotals,
    hasPreviousWeek,
    habits,
    streakAtWeekEnd,
    longestStreak,
}: IAssembleWeeklyRecapArgs): IWeeklyRecap => {
    const weekEndDate = getWeekEnd(weekStartDate);
    const totals = sumRecapTotals(days);
    const isPerfectWeek = isPerfectRecapWeek(days);
    const rankedHabits = rankRecapHabits(habits);

    return {
        weekStartDate,
        weekEndDate,
        timeZone,
        isCurrentWeek: getWeekStart(today) === weekStartDate,
        days,
        totals,
        previousTotals,
        hasPreviousWeek,
        habits: rankedHabits,
        topHabit: rankedHabits[0] || null,
        streakAtWeekEnd,
        longestStreak,
        isPerfectWeek,
        headline: pickWeeklyRecapHeadline({
            totals, previousTotals, hasPreviousWeek, isPerfectWeek,
        }),
    };
};

/**
 * Normalize a caller-supplied `weekStart`.
 *
 * Any date inside a week names that week — the client may send the Monday it
 * already holds or a day it read off a notification payload, and both should
 * resolve to the same recap. Anything that is not a date at all falls back to
 * the most recently closed week, which is what a bare `GET .../me` means.
 */
export const resolveRequestedWeekStart = (requested: unknown, today: string): string => {
    if (isDateString(requested)) {
        return getWeekStart(requested);
    }
    return getRecapWeekStart(today);
};
