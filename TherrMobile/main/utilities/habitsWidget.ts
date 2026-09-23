import { NativeModules, Platform } from 'react-native';
import { BrandVariations } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';

/**
 * The Friends with Habits Android home-screen widget.
 *
 * The widget never touches the network and never holds an auth token: the app builds a
 * small snapshot (rank, XP, daily streak, today's check-ins, top of the friends board) and
 * hands it to the native `HabitsWidget` module, which stores it in private SharedPreferences
 * and redraws every placed widget (android/.../widget/HabitsWidgetProvider.kt). The trade is
 * staleness while the app is closed; `periodEnd` lets the widget notice a week rollover on
 * its own and stop showing last week's rank.
 *
 * Labels are translated here, from the JS dictionaries, so the widget follows the in-app
 * locale rather than the device's. `{days}` in `resetsIn` is deliberately left unsubstituted
 * (the translator leaves unpassed placeholders verbatim) — the widget fills it at draw time
 * so the countdown moves without the app.
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
    };
}

type Translate = (key: string, params?: any) => string;

export const WIDGET_TOP_ROWS = 3;

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
        },
    };
};

const getNativeModule = () => NativeModules.HabitsWidget as {
    setSnapshot: (json: string) => Promise<boolean>;
    clear: () => Promise<boolean>;
} | undefined;

export const isHabitsWidgetSupported = (): boolean => Platform.OS === 'android'
    && CURRENT_BRAND_VARIATION === BrandVariations.HABITS
    && !!getNativeModule()?.setSnapshot;

// The last payload written, minus `updatedAt`, so a re-render that changes nothing does not
// cost a SharedPreferences write and a redraw of every placed widget.
let lastPublishedKey: string | null = null;

export const publishHabitsWidget = (snapshot: IHabitsWidgetSnapshot): void => {
    if (!isHabitsWidgetSupported()) {
        return;
    }
    const key = JSON.stringify({ ...snapshot, updatedAt: 0 });
    if (key === lastPublishedKey) {
        return;
    }
    lastPublishedKey = key;
    getNativeModule()!.setSnapshot(JSON.stringify(snapshot)).catch(() => {
        lastPublishedKey = null;
    });
};

/** On logout: the widget must never keep showing the previous account's rank. */
export const clearHabitsWidget = (): void => {
    lastPublishedKey = null;
    if (!isHabitsWidgetSupported()) {
        return;
    }
    getNativeModule()!.clear().catch(() => {});
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
