import { BrandVariations } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import Store from '../../store';
import { IDBUserDailyStreak } from '../../store/UserDailyStreaksStore';
import { IDailyStreakDay } from '../../store/DailyStreakDaysStore';
import {
    addDays,
    daysBetween,
    getLocalDate,
    getWeekEnd,
    getWeekStart,
    isDailyStreakMilestone,
    isDateString,
    isWeekEnd,
    isWeekPerfectThrough,
    resolveCheckinTimeZone,
    walkDailyStreakDays,
    DAILY_STREAK_MILESTONES,
    DailyStreakDayStatus,
    IDailyStreakWalkEvents,
    IDailyStreakWalkState,
    IFreezeSource,
} from '../../utilities/dailyStreak';
import { createOrUpdateAchievement } from './achievements';
import { awardLeaderboardPoints } from './leaderboards';
import { getPendingPlacementsForUser, IPendingPlacement } from './leaderboardPeriods';

/**
 * Leaderboard XP for each day the daily streak is upheld by a real check-in (frozen days earn
 * nothing). Configurable server-side; 0 disables it. Awarded at check-in time, once per local
 * day, so it lands in the period the day belongs to.
 */
export const DAILY_STREAK_BONUS_XP = Math.max(0, parseInt(process.env.DAILY_STREAK_BONUS_XP || '5', 10) || 0);

/** How many users the scheduled evaluate-all pass loads per page. */
const EVALUATE_ALL_PAGE_SIZE = 200;

/** How far back the ledger is scanned when the consecutive-perfect-weeks counter is rebuilt. */
const MAX_PERFECT_WEEK_LOOKBACK_WEEKS = 52;

// The achievement ladder rung for each milestone is the *delta* from the previous one — the
// store banks progress cumulatively per tier (see UserAchievementsStore.updateAndCreateConsecutive),
// so passing the delta completes each rung exactly at its milestone with no overshoot.
const milestoneDelta = (milestone: number): number => {
    const idx = DAILY_STREAK_MILESTONES.indexOf(milestone);
    if (idx === -1) {
        return 0;
    }
    return milestone - (idx === 0 ? 0 : DAILY_STREAK_MILESTONES[idx - 1]);
};

/**
 * Headers for an award that is not on a request path (the scheduled pass). No authorization:
 * the achievement row persists and its push is skipped, exactly as headersForOtherUser does.
 */
export const headersForDailyStreakUser = (userId: string): InternalConfigHeaders => ({
    'x-platform': 'mobile',
    'x-brand-variation': BrandVariations.HABITS,
    'x-localecode': 'en-us',
    'x-userid': userId,
});

const swallow = (label: string, userId: string) => (err: any) => {
    logSpan({
        level: 'warn',
        messageOrigin: 'API_SERVER',
        messages: [`Daily streak: ${label} failed`],
        traceArgs: { 'error.message': err?.message, 'user.id': userId },
    });
    return null;
};

/**
 * Turn walk events into achievement progress. Every award is idempotent at the achievement
 * store (a completed single-rung tier absorbs further progress as a no-op), and the milestone
 * ladder only receives first-time milestones (see walkDailyStreakDays), so re-evaluation never
 * double-awards. Fire-and-forget.
 */
export const awardDailyStreakAchievements = (headers: InternalConfigHeaders, events: IDailyStreakWalkEvents): void => {
    const userId = headers['x-userid'] || '';
    const award = (tier: string, progressCount: number, label: string) => createOrUpdateAchievement(headers, {
        achievementClass: 'dailyStreak',
        achievementTier: tier,
        progressCount,
    }).catch(swallow(`achievement ${label}`, userId));

    events.milestonesReached.forEach((milestone) => {
        const delta = milestoneDelta(milestone);
        if (delta > 0) {
            award('1_1', delta, `milestone:${milestone}`);
        }
    });
    if (events.perfectWeeksClosed > 0) {
        award('1_2', 1, 'perfect-week');
    }
    if (events.reachedConsecutivePerfectWeeks) {
        award('1_3', 1, 'perfect-week-x4');
    }
    if (events.comeback) {
        award('1_4', 1, 'comeback');
    }
    if (events.freezeSaved) {
        award('1_5', 1, 'freeze-saved');
    }
};

const loadFreezeSources = async (userId: string): Promise<IFreezeSource[]> => {
    const streaks = await Store.streaks.getByUserId(userId);
    return (streaks || [])
        .filter((streak: any) => streak.isActive !== false)
        .map((streak: any) => ({
            streakId: streak.id,
            habitGoalId: streak.habitGoalId,
            freezesRemaining: Math.max(0, (Number(streak.gracePeriodDays) || 0) - (Number(streak.graceDaysUsed) || 0)),
            currentStreak: Number(streak.currentStreak) || 0,
            createdAt: streak.createdAt || null,
        }));
};

const loadPriorWeekStatuses = async (userId: string, fromDate: string): Promise<Map<string, DailyStreakDayStatus>> => {
    const weekStart = getWeekStart(fromDate);
    const statuses = new Map<string, DailyStreakDayStatus>();
    if (weekStart === fromDate) {
        return statuses;
    }
    const rows = await Store.dailyStreakDays.getRange(userId, weekStart, addDays(fromDate, -1));
    rows.forEach((row) => statuses.set(row.localDate, row.status));
    return statuses;
};

/** The finalized streak length as of `date`: the ledger row's streakAfter, or 0 with no row. */
const streakAsOf = async (userId: string, date: string | null): Promise<number> => {
    if (!date) {
        return 0;
    }
    const [row] = await Store.dailyStreakDays.getRange(userId, date, date);
    return row ? row.streakAfter : 0;
};

const persistBorrowedFreezes = (freezesBorrowed: Map<string, number>, userId: string): Promise<any[]> => Promise.all(
    Array.from(freezesBorrowed.entries()).flatMap(([streakId, count]) => Array.from(
        { length: count },
        () => Store.streaks.useGraceDay(streakId).catch(swallow('freeze consume', userId)),
    )),
);

const laterDate = (a: string | null, b: string | null): string | null => {
    if (!a) {
        return b;
    }
    if (!b) {
        return a;
    }
    return a > b ? a : b;
};

export interface IEvaluateDailyStreakResult {
    state: IDBUserDailyStreak;
    events: IDailyStreakWalkEvents | null;
    daysEvaluated: number;
}

/**
 * Finalize every local day from `lastEvaluatedDate + 1` through `upTo` (normally the user's
 * local yesterday). Idempotent: an already-evaluated range is skipped outright, and the walk
 * itself is a pure function of the check-ins plus the freeze pool.
 *
 * First contact (no `lastEvaluatedDate`) walks from the user's earliest completed local day in
 * backfill mode — gaps reset, no freezes are borrowed — so the one-time history pass cannot
 * drain the freezes the user needs for tomorrow.
 */
export const evaluateDailyStreak = async (
    userId: string,
    upTo: string,
    headers: InternalConfigHeaders = headersForDailyStreakUser(userId),
): Promise<IEvaluateDailyStreakResult> => {
    const state = await Store.userDailyStreaks.getOrCreate(userId);
    if (!isDateString(upTo)) {
        return { state, events: null, daysEvaluated: 0 };
    }

    const isBackfill = !state.lastEvaluatedDate;
    const fromDate = state.lastEvaluatedDate
        ? addDays(state.lastEvaluatedDate, 1)
        : await Store.habitCheckins.getEarliestCompletedLocalDate(userId);

    if (!fromDate || daysBetween(fromDate, upTo) < 0) {
        // Nothing new to finalize (already evaluated through upTo, or no check-ins yet).
        return { state, events: null, daysEvaluated: 0 };
    }

    const [upheldDates, freezeSources, priorWeekStatuses, startStreak] = await Promise.all([
        Store.habitCheckins.getCompletedLocalDates(userId, fromDate, upTo),
        isBackfill ? Promise.resolve([] as IFreezeSource[]) : loadFreezeSources(userId),
        loadPriorWeekStatuses(userId, fromDate),
        streakAsOf(userId, state.lastEvaluatedDate),
    ]);

    const walkState: IDailyStreakWalkState = {
        currentStreak: startStreak,
        longestStreak: state.longestStreak,
        consecutivePerfectWeeks: state.consecutivePerfectWeeks,
        lastResetFromStreak: state.lastResetFromStreak,
    };

    const result = walkDailyStreakDays({
        state: walkState,
        fromDate,
        upTo,
        upheldDates,
        freezeSources,
        priorWeekStatuses,
        allowFreezes: !isBackfill,
    });

    await Store.dailyStreakDays.upsertMany(result.days, userId);
    await persistBorrowedFreezes(result.freezesBorrowed, userId);

    // `currentStreak` on the row is the live number the client shows. Today may already be
    // upheld (a live row past upTo): keep that unless the finalized range says the streak is
    // dead, in which case the live apply below will rebuild today from the finalized state.
    const liveTodayRow = state.lastUpheldDate && state.lastUpheldDate > upTo
        ? (await Store.dailyStreakDays.getRange(userId, state.lastUpheldDate, state.lastUpheldDate))[0]
        : undefined;
    const currentStreak = liveTodayRow ? result.state.currentStreak + 1 : result.state.currentStreak;
    const longestStreak = Math.max(result.state.longestStreak, currentStreak);

    if (liveTodayRow && liveTodayRow.streakAfter !== currentStreak) {
        await Store.dailyStreakDays.upsertMany([{ ...liveTodayRow, streakAfter: currentStreak }], userId);
    }

    const updated = await Store.userDailyStreaks.update(userId, {
        currentStreak,
        longestStreak,
        consecutivePerfectWeeks: result.state.consecutivePerfectWeeks,
        lastResetFromStreak: result.state.lastResetFromStreak,
        lastEvaluatedDate: upTo,
        lastUpheldDate: laterDate(state.lastUpheldDate, result.events.lastUpheldDate),
    });

    awardDailyStreakAchievements(headers, result.events);

    return {
        state: updated || { ...state, currentStreak, longestStreak },
        events: result.events,
        daysEvaluated: result.days.length,
    };
};

/**
 * Credit today live, without finalizing it: once the user has a completed check-in with
 * `localDate = today`, write today's ledger row as upheld and bump the live streak so the
 * celebration (and the leaderboard chip) reflect it now rather than after the nightly pass.
 *
 * `lastEvaluatedDate` is left alone — the nightly walk re-derives today from the check-ins and
 * lands on the identical row (upsert), and the walk starts from the finalized streak at
 * `lastEvaluatedDate`, not from the live number, so today is never counted twice. Perfect-week
 * bookkeeping (`consecutivePerfectWeeks`) is also left to the finalizing walk for the same
 * reason; the celebration screen judges a perfect week from the ledger directly.
 */
export const applyLiveToday = async (
    userId: string,
    today: string,
    headers: InternalConfigHeaders = headersForDailyStreakUser(userId),
): Promise<IDBUserDailyStreak> => {
    const state = await Store.userDailyStreaks.getOrCreate(userId);
    if (state.lastUpheldDate === today) {
        return state;
    }

    const completedToday = await Store.habitCheckins.countCompletedOnLocalDate(userId, today);
    if (completedToday === 0) {
        return state;
    }

    const yesterday = addDays(today, -1);
    const [startStreak, priorWeekStatuses] = await Promise.all([
        streakAsOf(userId, yesterday),
        loadPriorWeekStatuses(userId, today),
    ]);

    const result = walkDailyStreakDays({
        state: {
            currentStreak: startStreak,
            longestStreak: state.longestStreak,
            consecutivePerfectWeeks: state.consecutivePerfectWeeks,
            lastResetFromStreak: state.lastResetFromStreak,
        },
        fromDate: today,
        upTo: today,
        upheldDates: new Set([today]),
        freezeSources: [],
        priorWeekStatuses,
    });

    await Store.dailyStreakDays.upsertMany(result.days, userId);
    const updated = await Store.userDailyStreaks.update(userId, {
        currentStreak: result.state.currentStreak,
        longestStreak: result.state.longestStreak,
        lastResetFromStreak: result.state.lastResetFromStreak,
        lastUpheldDate: today,
    });

    // Milestone and comeback fire now; perfect-week events wait for the finalizing walk.
    awardDailyStreakAchievements(headers, {
        ...result.events,
        perfectWeeksClosed: 0,
        reachedConsecutivePerfectWeeks: false,
        freezeSaved: false,
    });

    return updated || state;
};

/**
 * Rebuild `consecutivePerfectWeeks` from the ledger: count perfect Monday–Sunday weeks ending at
 * the last week that closed strictly before `beforeDate`, walking backwards until one is not.
 */
const recomputeConsecutivePerfectWeeks = async (userId: string, beforeDate: string): Promise<number> => {
    const lastClosedWeekEnd = addDays(getWeekStart(beforeDate), -1); // the Sunday before this week
    const rangeStart = addDays(lastClosedWeekEnd, -(7 * MAX_PERFECT_WEEK_LOOKBACK_WEEKS) + 1);
    const rows = await Store.dailyStreakDays.getRange(userId, rangeStart, lastClosedWeekEnd);
    const statuses = new Map<string, DailyStreakDayStatus>();
    rows.forEach((row) => statuses.set(row.localDate, row.status));

    let count = 0;
    for (let weekEnd = lastClosedWeekEnd; daysBetween(rangeStart, weekEnd) >= 6; weekEnd = addDays(weekEnd, -7)) {
        let isPerfect = true;
        for (let i = 0; i < 7; i += 1) {
            if (statuses.get(addDays(weekEnd, -i)) !== 'upheld') {
                isPerfect = false;
                break;
            }
        }
        if (!isPerfect) {
            break;
        }
        count += 1;
    }
    return count;
};

/**
 * Re-open every day from `fromDate` on: delete those ledger rows, refund any freeze they
 * borrowed, and roll the state back to the day before, so the next evaluation re-derives them
 * from the check-ins as they now stand. This is the only path that touches an already-
 * finalized day, and it is how a backdated check-in that fills a frozen day refunds the freeze
 * (the re-walk finds the day upheld and borrows nothing) and how deleting the only check-in for
 * a day re-opens it.
 */
export const rewindDailyStreak = async (userId: string, fromDate: string): Promise<void> => {
    const state = await Store.userDailyStreaks.getOrCreate(userId);
    const deleted = await Store.dailyStreakDays.deleteOnOrAfter(userId, fromDate);

    const frozen = deleted.filter((row: IDailyStreakDay) => row.status === 'frozen' && row.freezeHabitGoalId);
    await Promise.all(frozen.map(async (row: IDailyStreakDay) => {
        const streak = await Store.streaks.getByUserAndHabit(userId, row.freezeHabitGoalId as string);
        if (streak) {
            await Store.streaks.refundGraceDay(streak.id).catch(swallow('freeze refund', userId));
        }
    }));

    const dayBefore = addDays(fromDate, -1);
    const [previous, previousUpheld, consecutivePerfectWeeks] = await Promise.all([
        Store.dailyStreakDays.getLatestBefore(userId, fromDate),
        Store.dailyStreakDays.getLatestUpheldBefore(userId, fromDate),
        deleted.some((row: IDailyStreakDay) => isWeekEnd(row.localDate))
            ? recomputeConsecutivePerfectWeeks(userId, fromDate)
            : Promise.resolve(state.consecutivePerfectWeeks),
    ]);

    await Store.userDailyStreaks.update(userId, {
        currentStreak: previous ? previous.streakAfter : 0,
        lastUpheldDate: previousUpheld ? previousUpheld.localDate : null,
        lastEvaluatedDate: state.lastEvaluatedDate && state.lastEvaluatedDate >= fromDate
            ? dayBefore
            : state.lastEvaluatedDate,
        consecutivePerfectWeeks,
    });
};

/** Evaluate through yesterday, then credit today live if it is already upheld. */
export const syncDailyStreak = async (
    userId: string,
    today: string,
    headers?: InternalConfigHeaders,
): Promise<IDBUserDailyStreak> => {
    await evaluateDailyStreak(userId, addDays(today, -1), headers);
    return applyLiveToday(userId, today, headers);
};

export interface ICheckinDailyStreakArgs {
    userId: string;
    /** The check-in's local day, already resolved by the caller. */
    localDate: string;
    /** The user's local today. */
    today: string;
    headers: InternalConfigHeaders;
}

/**
 * Hook for a completed check-in. Today and yesterday move the daily streak; anything older
 * counts for the habit only. Yesterday goes through the rewind so a day the nightly pass
 * already froze or missed is re-derived (and its freeze refunded).
 *
 * The per-day XP bonus is awarded here, once per local day, when this check-in is the first
 * completed one on that day — the count includes the row just written, so "== 1" is exact.
 */
export const onCheckinCompleted = async ({
    userId, localDate, today, headers,
}: ICheckinDailyStreakArgs): Promise<IDBUserDailyStreak | null> => {
    const yesterday = addDays(today, -1);
    if (localDate !== today && localDate !== yesterday) {
        return null;
    }

    const completedOnDay = await Store.habitCheckins.countCompletedOnLocalDate(userId, localDate);
    const isFirstForDay = completedOnDay === 1;

    if (localDate === yesterday) {
        await rewindDailyStreak(userId, yesterday);
    }
    const state = await syncDailyStreak(userId, today, headers);

    if (isFirstForDay && DAILY_STREAK_BONUS_XP > 0) {
        awardLeaderboardPoints(headers, DAILY_STREAK_BONUS_XP, `daily-streak-day:${localDate}`);
    }

    return state;
};

/**
 * Hook for a deleted check-in: if it was the only completed check-in on a day the streak still
 * cares about (today or yesterday), re-open that day.
 */
export const onCheckinDeleted = async ({
    userId, localDate, today, headers,
}: ICheckinDailyStreakArgs): Promise<void> => {
    const yesterday = addDays(today, -1);
    if (localDate !== today && localDate !== yesterday) {
        return;
    }
    const remaining = await Store.habitCheckins.countCompletedOnLocalDate(userId, localDate);
    if (remaining > 0) {
        return;
    }
    await rewindDailyStreak(userId, localDate);
    await syncDailyStreak(userId, today, headers);
};

// ---------------------------------------------------------------------------------------------
// Read model
// ---------------------------------------------------------------------------------------------

export type WeekDayStatus = DailyStreakDayStatus | 'future' | 'pending';

export interface IWeekDay {
    date: string;
    /** 0 = Monday … 6 = Sunday. */
    dow: number;
    status: WeekDayStatus;
    isToday: boolean;
}

export interface IPendingCelebration {
    kind: 'day' | 'milestone';
    streak: number;
    isPerfectWeek: boolean;
    isNewLongest: boolean;
}

export interface IDailyStreakView {
    currentStreak: number;
    longestStreak: number;
    today: string;
    week: IWeekDay[];
    pendingCelebration: IPendingCelebration | null;
}

export interface IDailyStreakSummary extends IDailyStreakView {
    timeZone: string;
    pendingPlacements: IPendingPlacement[];
}

export const buildWeek = (today: string, rows: IDailyStreakDay[]): IWeekDay[] => {
    const byDate = new Map<string, DailyStreakDayStatus>();
    rows.forEach((row) => byDate.set(row.localDate, row.status));
    const weekStart = getWeekStart(today);

    return Array.from({ length: 7 }, (_, dow) => {
        const date = addDays(weekStart, dow);
        let status: WeekDayStatus;
        if (date > today) {
            status = 'future';
        } else if (byDate.has(date)) {
            status = byDate.get(date) as DailyStreakDayStatus;
        } else {
            status = date === today ? 'pending' : 'missed';
        }
        return {
            date, dow, status, isToday: date === today,
        };
    });
};

/**
 * Whether the server owes the client a celebration right now. Server-decided; the client never
 * infers it: last upheld day is today AND today has not been celebrated yet.
 */
export const getPendingCelebration = (state: IDBUserDailyStreak, today: string, week: IWeekDay[]): IPendingCelebration | null => {
    if (state.lastUpheldDate !== today || state.lastCelebratedDate === today) {
        return null;
    }
    const statuses = new Map<string, WeekDayStatus>(week.map((day) => [day.date, day.status]));
    return {
        kind: isDailyStreakMilestone(state.currentStreak) ? 'milestone' : 'day',
        streak: state.currentStreak,
        isPerfectWeek: isWeekEnd(today) && isWeekPerfectThrough(today, statuses),
        isNewLongest: state.currentStreak > 1 && state.currentStreak === state.longestStreak,
    };
};

/**
 * The streak the client renders: the numbers, this week's strip, and whether a celebration is
 * owed. Reads only — call `syncDailyStreak` first when the state may be stale.
 */
export const getDailyStreakView = async (
    userId: string,
    today: string,
    state?: IDBUserDailyStreak,
): Promise<IDailyStreakView> => {
    const resolvedState = state || await Store.userDailyStreaks.getOrCreate(userId);
    const rows = await Store.dailyStreakDays.getRange(userId, getWeekStart(today), getWeekEnd(today));
    const week = buildWeek(today, rows);

    return {
        currentStreak: resolvedState.currentStreak,
        longestStreak: resolvedState.longestStreak,
        today,
        week,
        pendingCelebration: getPendingCelebration(resolvedState, today, week),
    };
};

export const getDailyStreakSummary = async (
    userId: string,
    headers: InternalConfigHeaders,
    { settingsTimezone, deviceTimezone, brand }: { settingsTimezone: unknown; deviceTimezone?: unknown; brand: string },
    now: Date = new Date(),
): Promise<IDailyStreakSummary> => {
    const timeZone = resolveCheckinTimeZone(settingsTimezone, deviceTimezone);
    const today = getLocalDate(timeZone, now);

    const state = await syncDailyStreak(userId, today, headers);
    const [view, pendingPlacements] = await Promise.all([
        getDailyStreakView(userId, today, state),
        getPendingPlacementsForUser(brand as any, userId, now).catch((err) => {
            swallow('pending placements', userId)(err);
            return [] as IPendingPlacement[];
        }),
    ]);

    return { ...view, timeZone, pendingPlacements };
};

export interface IEvaluateAllCounters {
    usersEvaluated: number;
    daysEvaluated: number;
    errors: number;
}

/**
 * The scheduled pass: finalize yesterday (in each user's own zone) for every user with a habit
 * streak, so leaderboard chips, achievements and celebrations stay current for people who do
 * not open the app. Safe to run at any cadence — hourly covers "03:00 in every timezone" without
 * bucketing, since evaluating through yesterday is a no-op once done.
 */
export const evaluateAllDailyStreaks = async (now: Date = new Date()): Promise<IEvaluateAllCounters> => {
    const counters: IEvaluateAllCounters = { usersEvaluated: 0, daysEvaluated: 0, errors: 0 };
    let afterUserId: string | undefined;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        // eslint-disable-next-line no-await-in-loop
        const targets = await Store.userDailyStreaks.getEvaluationTargets(EVALUATE_ALL_PAGE_SIZE, afterUserId);
        if (!targets.length) {
            break;
        }
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(targets.map(async (target) => {
            const timeZone = resolveCheckinTimeZone(target.settingsTimezone);
            const yesterday = addDays(getLocalDate(timeZone, now), -1);
            try {
                const result = await evaluateDailyStreak(target.userId, yesterday);
                counters.usersEvaluated += 1;
                counters.daysEvaluated += result.daysEvaluated;
            } catch (err: any) {
                counters.errors += 1;
                swallow('scheduled evaluation', target.userId)(err);
            }
        }));
        afterUserId = targets[targets.length - 1].userId;
    }

    return counters;
};
