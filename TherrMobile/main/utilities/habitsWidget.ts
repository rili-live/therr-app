import { NativeModules, Platform } from 'react-native';
import { BrandVariations } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';
import { fromGoal, ICadenceGoalFields } from '../routes/Pacts/cadenceOptions';

/**
 * The Friends with Habits Android home-screen widget.
 *
 * The widget never touches the network and never holds an auth token: the app builds a
 * small snapshot (rank, XP, daily streak, today's check-ins, and the top of both the friends
 * and the global board) and hands it to the native `HabitsWidget` module, which stores it in private SharedPreferences
 * and redraws every placed widget (android/.../widget/HabitsWidgetProvider.kt). `periodEnd`
 * lets the widget notice a week rollover on its own and stop showing last week's rank.
 *
 * The same snapshot feeds a second, smaller widget (android/.../widget/HabitsStreakWidgetProvider.kt)
 * that shows only `streak`: the app-level daily streak, with its label already pluralized here.
 * That widget also warns in the evening when the streak is at stake. The warning depends on the
 * clock, so the widget decides it at draw time; the snapshot carries the facts it needs — the
 * server's verdict on whether today is at stake (`stake`), the local day a check-in already
 * counted (`checkedInOn`), and the weekdays a habit is due on, for when there is no verdict.
 *
 * Both boards ride in every snapshot so the widget's Friends / Everyone toggle switches
 * instantly, offline included. The choice is stored natively and sticks across refreshes and
 * reboots; until the user makes one, the widget shows `scope` (friends, or global for a user
 * with no friends on the board yet).
 *
 * While the app is closed the snapshot is kept fresh by `habitsWidgetRefresh.ts`: the widget
 * asks for a refresh on its periodic tick, when it is first placed and when its "updated N ago"
 * label is tapped, and the app asks for one when a habits push arrives. That task runs in the
 * headless JS context with the stored session and publishes through the same module.
 *
 * Labels are translated here, from the JS dictionaries, so the widget follows the in-app
 * locale rather than the device's. Placeholders such as `{days}` in `resetsIn` and `{minutes}`
 * in `minutesAgo` are deliberately left unsubstituted (the translator leaves unpassed
 * placeholders verbatim) — the widget fills them at draw time so the countdown and the
 * freshness label move without the app.
 *
 * Everything here is decoration: every entry point swallows its own errors and no-ops off
 * Android, off the habits brand, or when the native module is not linked.
 */

export type HabitsWidgetScope = 'connections' | 'global';

export interface IHabitsWidgetLeaderboardResponse {
    entries?: Array<{
        rank: number;
        userName: string;
        points: number;
        dailyStreak?: number;
        isRequestingUser?: boolean;
    }>;
    currentUser?: {
        rank: number;
        points: number;
        dailyStreak?: number;
    };
    periodEnd?: string | null;
}

/** Both boards the widget can show; the toggle switches between them without a fetch. */
export interface IHabitsWidgetBoards {
    connections: IHabitsWidgetLeaderboardResponse;
    global: IHabitsWidgetLeaderboardResponse;
}

/** One board as the widget draws it: your standing, the top rows and the labels that name it. */
export interface IHabitsWidgetBoardView {
    you: { rank: number; points: number; dailyStreak: number };
    top: Array<{ rank: number; userName: string; points: number; dailyStreak: number; isYou: boolean }>;
    labels: {
        rankContext: string;
        points: string;
    };
}

export interface IHabitsWidgetSnapshot {
    v: 2;
    /**
     * The board shown until the user picks one on the widget's toggle: friends, or the global
     * board for a user with no one on theirs. Once picked, the widget remembers the choice
     * natively and ignores this.
     */
    scope: HabitsWidgetScope;
    /** Whether anyone but the user is on the friends board; the widget offers an invite when not. */
    hasFriends: boolean;
    periodEnd: string | null;
    updatedAt: number;
    today: { done: number; total: number };
    /**
     * The app-level daily streak, for the streak widget. `label` is what sits under the count
     * ("day streak", pluralized for `days`), or the prompt to start one when `days` is 0.
     */
    streak: {
        days: number;
        label: string;
        /** Shown in place of `label` while the streak is at risk. */
        atRiskLabel: string;
        /**
         * The device-local day (YYYY-MM-DD) a completed check-in already counts for, or null.
         * A date rather than a flag, so the widget can tell yesterday's check-in from today's
         * after midnight without the app.
         */
        checkedInOn: string | null;
        /**
         * The server's verdict (`isAtStakeToday` on GET /habits/daily-streak/me) and the local day
         * it is about, or null when there is none. The widget trusts it only on that day, so a
         * verdict from before midnight, or from a server that predates the field, falls back to
         * `dueWeekdays`. It knows what `dueWeekdays` cannot: whether a weekly-count habit needs
         * today.
         */
        stake: IHabitsWidgetStakeVerdict | null;
        /**
         * Weekdays (0 = Sunday … 6 = Saturday) on which a live habit is due: every day for a daily
         * habit, its days for a fixed-day one. A weekly-count habit adds none — whether today is
         * one it needs depends on the rest of its week, which the widget cannot see, and a
         * warning on a day that costs nothing is how a warning stops being believed.
         */
        dueWeekdays: number[];
    };
    boards: Record<HabitsWidgetScope, IHabitsWidgetBoardView>;
    labels: {
        /** The toggle's two segments. */
        scopeFriends: string;
        scopeEveryone: string;
        resetsIn: string;
        today: string;
        todayProgress: string;
        newWeek: string;
        invite: string;
        /** Shown in place of the freshness label while a background refresh is running. */
        refreshing: string;
        /** Freshness label variants; the widget picks one and fills the placeholder. */
        justNow: string;
        minutesAgo: string;
        hoursAgo: string;
        daysAgo: string;
        /** Accessibility text for the freshness label, with `{ago}` filled by the widget. */
        refreshHint: string;
    };
}

type Translate = (key: string, params?: any) => string;

/** Whether the daily streak is at stake on `date`, as users-service decided it. */
export interface IHabitsWidgetStakeVerdict {
    date: string;
    isAtStake: boolean;
}

/** Today's check-ins, as the dashboard counts them, plus what the streak widget's warning needs. */
export interface IHabitsWidgetToday {
    done: number;
    total: number;
    /** See `streak.dueWeekdays`; from `getDueWeekdays`. Absent means no warning. */
    dueWeekdays?: number[];
    /** See `streak.stake`; from `getStakeVerdict`. */
    stake?: IHabitsWidgetStakeVerdict | null;
}

/**
 * The verdict in a GET /habits/daily-streak/me summary, or null when the summary is missing or
 * comes from a server that does not send `isAtStakeToday` yet.
 */
export const getStakeVerdict = (summary?: { today?: unknown; isAtStakeToday?: unknown } | null): IHabitsWidgetStakeVerdict | null => {
    if (!summary || typeof summary.isAtStakeToday !== 'boolean' || typeof summary.today !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/.test(summary.today)) {
        return null;
    }
    return { date: summary.today, isAtStake: summary.isAtStakeToday };
};

export const WIDGET_TOP_ROWS = 3;

/**
 * The headless task the widget's background refresh runs, registered in index.js. Must match
 * `HabitsWidgetRefreshWorker.TASK_KEY` in android/.../widget/HabitsWidgetRefreshWorker.kt —
 * `__tests__/androidHabitsWidget.test.ts` checks that it does.
 */
export const WIDGET_REFRESH_TASK_KEY = 'HabitsWidgetRefresh';

/**
 * A friends board is only worth showing by default when it has someone other than the requester
 * on it; otherwise the widget defaults to the global board and offers an invite instead.
 */
export const hasFriendsOnBoard = (response?: IHabitsWidgetLeaderboardResponse | null): boolean => (
    (response?.entries || []).some((entry) => !entry.isRequestingUser)
);

const buildBoardView = (
    board: IHabitsWidgetLeaderboardResponse,
    scope: HabitsWidgetScope,
    translate: Translate,
): IHabitsWidgetBoardView => {
    const you = board.currentUser;
    const points = Number(you?.points) || 0;

    return {
        you: {
            rank: Number(you?.rank) || 0,
            points,
            dailyStreak: Number(you?.dailyStreak) || 0,
        },
        top: (board.entries || []).slice(0, WIDGET_TOP_ROWS).map((entry) => ({
            rank: Number(entry.rank) || 0,
            userName: entry.userName || '',
            points: Number(entry.points) || 0,
            dailyStreak: Number(entry.dailyStreak) || 0,
            isYou: !!entry.isRequestingUser,
        })),
        labels: {
            rankContext: translate(scope === 'connections'
                ? 'pages.habits.widget.amongFriends'
                : 'pages.habits.widget.overall'),
            points: translate('pages.leaderboard.labels.xpPoints', { points }),
        },
    };
};

/**
 * The line under the streak widget's count. Chosen here rather than natively so it follows the
 * in-app locale; Spanish and French need the singular at 1, and English reads the same either way.
 */
export const getStreakLabel = (days: number, translate: Translate): string => {
    if (days <= 0) {
        return translate('pages.habits.widget.streakStart');
    }
    return days === 1
        ? translate('pages.habits.widget.streakDayOne')
        : translate('pages.celebration.streak.dayStreak');
};

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** The weekdays a live habit is due on; see `streak.dueWeekdays`. */
export const getDueWeekdays = (goals: Array<ICadenceGoalFields | null | undefined>): number[] => {
    const due = new Set<number>();
    goals.forEach((goal) => {
        if (!goal) {
            return;
        }
        const cadence = fromGoal(goal);
        if (cadence.kind === 'daily') {
            ALL_WEEKDAYS.forEach((day) => due.add(day));
        } else if (cadence.kind === 'weekdays') {
            cadence.days.forEach((day) => due.add(day));
        }
    });
    return ALL_WEEKDAYS.filter((day) => due.has(day));
};

/** YYYY-MM-DD in the device's own zone — the same day the widget reads off its clock. */
export const toLocalDateString = (at: number): string => {
    const date = new Date(at);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const buildHabitsWidgetSnapshot = (
    boards: IHabitsWidgetBoards,
    today: IHabitsWidgetToday,
    translate: Translate,
    now: number = Date.now(),
): IHabitsWidgetSnapshot => {
    const total = Math.max(0, today.total);
    const done = Math.min(Math.max(0, today.done), total);
    const hasFriends = hasFriendsOnBoard(boards.connections);
    const friendsBoard = buildBoardView(boards.connections, 'connections', translate);
    const globalBoard = buildBoardView(boards.global, 'global', translate);
    // The same number on both boards; the larger survives a board that left `currentUser` out.
    const streakDays = Math.max(friendsBoard.you.dailyStreak, globalBoard.you.dailyStreak);

    return {
        v: 2,
        scope: hasFriends ? 'connections' : 'global',
        hasFriends,
        // Both are this week's boards; they share a reset.
        periodEnd: boards.connections.periodEnd || boards.global.periodEnd || null,
        updatedAt: now,
        today: { done, total },
        streak: {
            days: streakDays,
            label: getStreakLabel(streakDays, translate),
            atRiskLabel: translate('pages.habits.widget.streakAtRisk'),
            // Today's check-ins are read in the device's zone (see habitsWidgetRefresh.ts), so a
            // completed one counts for the device's today.
            checkedInOn: done > 0 ? toLocalDateString(now) : null,
            stake: today.stake || null,
            dueWeekdays: today.dueWeekdays || [],
        },
        boards: { connections: friendsBoard, global: globalBoard },
        labels: {
            scopeFriends: translate('pages.leaderboard.tabs.friends'),
            scopeEveryone: translate('pages.leaderboard.tabs.everyone'),
            resetsIn: translate('pages.leaderboard.labels.resetsIn'),
            today: translate('pages.habits.todayProgress'),
            todayProgress: total > 0
                ? translate('pages.habits.widget.habitsDone', { done, total })
                : translate('pages.habits.widget.startHabit'),
            newWeek: translate('pages.habits.widget.newWeek'),
            invite: translate('pages.habits.widget.inviteFriends'),
            refreshing: translate('pages.habits.widget.refreshing'),
            justNow: translate('pages.habits.widget.justNow'),
            minutesAgo: translate('pages.habits.widget.minutesAgo'),
            hoursAgo: translate('pages.habits.widget.hoursAgo'),
            daysAgo: translate('pages.habits.widget.daysAgo'),
            refreshHint: translate('pages.habits.widget.refreshHint'),
        },
    };
};

const getNativeModule = () => NativeModules.HabitsWidget as {
    setSnapshot: (json: string) => Promise<boolean>;
    clear: () => Promise<boolean>;
    finishRefresh: () => Promise<boolean>;
    hasWidgets: () => Promise<boolean>;
} | undefined;

export const isHabitsWidgetSupported = (): boolean => Platform.OS === 'android'
    && CURRENT_BRAND_VARIATION === BrandVariations.HABITS
    && !!getNativeModule()?.setSnapshot;

// The last payload written, minus `updatedAt`, so a re-render that changes nothing does not
// cost a SharedPreferences write and a redraw of every placed widget.
let lastPublishedKey: string | null = null;

/**
 * Writes the snapshot and redraws every placed widget. Returns whether a write was issued.
 *
 * `force` writes even when nothing but `updatedAt` changed. The in-app publishers leave it off
 * (a re-render that changes nothing should not cost a redraw); the background refresh sets it,
 * because there the timestamp *is* the news — it is what the widget's "updated N ago" label and
 * its refresh throttle read, and a check that found no change still counts as a check.
 */
export const publishHabitsWidget = (snapshot: IHabitsWidgetSnapshot, { force = false }: { force?: boolean } = {}): boolean => {
    if (!isHabitsWidgetSupported()) {
        return false;
    }
    const key = JSON.stringify({ ...snapshot, updatedAt: 0 });
    if (!force && key === lastPublishedKey) {
        return false;
    }
    lastPublishedKey = key;
    getNativeModule()!.setSnapshot(JSON.stringify(snapshot)).catch(() => {
        lastPublishedKey = null;
    });
    return true;
};

/** On logout: the widget must never keep showing the previous account's rank. */
export const clearHabitsWidget = (): void => {
    lastPublishedKey = null;
    if (!isHabitsWidgetSupported()) {
        return;
    }
    getNativeModule()!.clear().catch(() => {});
};

/**
 * Ends the widget's "Refreshing…" state without a new snapshot — for a background refresh that
 * found nothing to publish (offline, signed out, an expired token). Publishing a snapshot ends
 * it too, so this is only for the paths that publish nothing; without it the label would sit on
 * "Refreshing…" until the provider's own stale-flag timeout.
 */
export const finishHabitsWidgetRefresh = (): void => {
    if (!isHabitsWidgetSupported()) {
        return;
    }
    getNativeModule()!.finishRefresh().catch(() => {});
};

/**
 * Whether at least one widget is on a home screen. The background refresh asks before spending
 * network on a snapshot nothing would draw — a push arrives whether or not the widget exists.
 */
export const hasHabitsWidgets = (): Promise<boolean> => {
    const nativeModule = getNativeModule();
    if (!isHabitsWidgetSupported() || !nativeModule?.hasWidgets) {
        return Promise.resolve(false);
    }
    return nativeModule.hasWidgets().catch(() => false);
};

// Android launcher-widget tap actions. Matched by suffix, like the app shortcuts in Layout,
// so the same JS handles every brand binary's package prefix.
export const WIDGET_ACTION_SUFFIXES = {
    // The board the widget is showing, as picked on its Friends / Everyone toggle.
    OPEN_LEADERBOARD: '.WIDGET_OPEN_LEADERBOARD',
    OPEN_LEADERBOARD_GLOBAL: '.WIDGET_OPEN_LEADERBOARD_GLOBAL',
    OPEN_TODAY: '.WIDGET_OPEN_TODAY',
    INVITE_FRIENDS: '.WIDGET_INVITE_FRIENDS',
};

/** Where a widget tap lands, or null when the action is not a widget action. */
export const getWidgetActionRoute = (action?: string | null): { view: string; params: any } | null => {
    if (!action) {
        return null;
    }
    if (action.endsWith(WIDGET_ACTION_SUFFIXES.OPEN_LEADERBOARD)) {
        return { view: 'Leaderboard', params: { initialScope: 'connections' } };
    }
    if (action.endsWith(WIDGET_ACTION_SUFFIXES.OPEN_LEADERBOARD_GLOBAL)) {
        return { view: 'Leaderboard', params: { initialScope: 'global' } };
    }
    if (action.endsWith(WIDGET_ACTION_SUFFIXES.OPEN_TODAY)) {
        return { view: 'HabitsDashboard', params: { initialTab: 'habits' } };
    }
    if (action.endsWith(WIDGET_ACTION_SUFFIXES.INVITE_FRIENDS)) {
        return { view: 'Invite', params: {} };
    }
    return null;
};
