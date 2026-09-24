import { NativeModules, Platform } from 'react-native';
import { BrandVariations } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';

/**
 * The Friends with Habits Android home-screen widget.
 *
 * The widget never touches the network and never holds an auth token: the app builds a
 * small snapshot (rank, XP, daily streak, today's check-ins, top of the friends board) and
 * hands it to the native `HabitsWidget` module, which stores it in private SharedPreferences
 * and redraws every placed widget (android/.../widget/HabitsWidgetProvider.kt). `periodEnd`
 * lets the widget notice a week rollover on its own and stop showing last week's rank.
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

export interface IHabitsWidgetSnapshot {
    v: 1;
    scope: HabitsWidgetScope;
    periodEnd: string | null;
    updatedAt: number;
    you: { rank: number; points: number; dailyStreak: number };
    today: { done: number; total: number };
    top: Array<{ rank: number; userName: string; points: number; dailyStreak: number; isYou: boolean }>;
    labels: {
        title: string;
        rankContext: string;
        points: string;
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

export const WIDGET_TOP_ROWS = 3;

/**
 * The headless task the widget's background refresh runs, registered in index.js. Must match
 * `HabitsWidgetRefreshWorker.TASK_KEY` in android/.../widget/HabitsWidgetRefreshWorker.kt —
 * `__tests__/androidHabitsWidget.test.ts` checks that it does.
 */
export const WIDGET_REFRESH_TASK_KEY = 'HabitsWidgetRefresh';

/**
 * A friends board is only worth showing when it has someone other than the requester on it;
 * otherwise the widget falls back to the global board and offers an invite instead.
 */
export const hasFriendsOnBoard = (response?: IHabitsWidgetLeaderboardResponse | null): boolean => (
    (response?.entries || []).some((entry) => !entry.isRequestingUser)
);

export const buildHabitsWidgetSnapshot = (
    board: IHabitsWidgetLeaderboardResponse,
    scope: HabitsWidgetScope,
    today: { done: number; total: number },
    translate: Translate,
    now: number = Date.now(),
): IHabitsWidgetSnapshot => {
    const you = board.currentUser;
    const points = Number(you?.points) || 0;
    const total = Math.max(0, today.total);
    const done = Math.min(Math.max(0, today.done), total);

    return {
        v: 1,
        scope,
        periodEnd: board.periodEnd || null,
        updatedAt: now,
        you: {
            rank: Number(you?.rank) || 0,
            points,
            dailyStreak: Number(you?.dailyStreak) || 0,
        },
        today: { done, total },
        top: (board.entries || []).slice(0, WIDGET_TOP_ROWS).map((entry) => ({
            rank: Number(entry.rank) || 0,
            userName: entry.userName || '',
            points: Number(entry.points) || 0,
            dailyStreak: Number(entry.dailyStreak) || 0,
            isYou: !!entry.isRequestingUser,
        })),
        labels: {
            title: translate(scope === 'connections'
                ? 'pages.habits.widget.friendsThisWeek'
                : 'pages.habits.widget.everyoneThisWeek'),
            rankContext: translate(scope === 'connections'
                ? 'pages.habits.widget.amongFriends'
                : 'pages.habits.widget.overall'),
            points: translate('pages.leaderboard.labels.xpPoints', { points }),
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
    // The board the widget is showing: friends, or the global fallback for a user with none.
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
