import { PushNotifications } from 'therr-js-utilities/constants';
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';
import { countTodayProgress, splitHabitsByPactState } from '../routes/Habits/pactState';
import getConfig from './getConfig';
import getDeviceTimeZone from './deviceTimeZone';
import readStoredSession from './storedSession';
import translator from './translator';
import {
    buildHabitsWidgetSnapshot,
    finishHabitsWidgetRefresh,
    hasFriendsOnBoard,
    hasHabitsWidgets,
    HabitsWidgetScope,
    IHabitsWidgetLeaderboardResponse,
    isHabitsWidgetSupported,
    publishHabitsWidget,
    WIDGET_TOP_ROWS,
} from './habitsWidget';

/**
 * The home-screen widget's background refresh: the "live reload" the widget has without the app.
 *
 * Runs as a headless JS task (registered in index.js under `WIDGET_REFRESH_TASK_KEY`), started by
 * `HabitsWidgetRefreshWorker` when the widget asks — on its periodic tick, on first placement and
 * on a tap of its freshness label — and directly from the push handlers when a habits
 * notification arrives, since a friend checking in is exactly the moment the board moved.
 *
 * ## Why this does not use `axios` / the services
 *
 * Same reason as `backgroundCheckin.ts`: those depend on `initInterceptors`, which only runs
 * once the React tree is mounted. In the headless context `axios.defaults.baseURL` is unset and
 * nothing attaches the token, so a refresh built on them would work only when the app happened
 * to be warm. This reads the stored session and issues plain `fetch`es.
 *
 * ## It fetches what the dashboard fetches
 *
 * The widget's "2/3 habits" is the dashboard's number, and the dashboard derives it from four
 * lists (goals, active pacts, all pacts, tracked habits) plus today's check-ins — a goal whose
 * only pact is still pending is not checkin-able, so it is not in the denominator. Those go
 * through the same `splitHabitsByPactState` / `countTodayProgress` the dashboard uses, so the
 * widget and the screen cannot disagree about today.
 *
 * ## Failure keeps the last snapshot
 *
 * Every failure path publishes nothing and only ends the widget's "Refreshing…" state: a stale
 * board is better than a blank one, and better than a wrong one (a leaderboard that loaded next
 * to a goals list that did not would render "Start a habit →" at a user with three). An expired
 * token is a failure like any other — there is no refresh flow here (see `storedSession.ts`),
 * so the widget waits for the next app session, and its freshness label says how long.
 */

export type HabitsWidgetRefreshReason = 'periodic' | 'placed' | 'tap' | 'push' | 'foreground-push';

export interface IHabitsWidgetRefreshResult {
    published: boolean;
    reason: HabitsWidgetRefreshReason;
    /** Why nothing was published, for logs and tests. */
    skipped?: 'unsupported' | 'no-widgets' | 'no-session' | 'unauthorized' | 'request-failed';
}

const REQUEST_TIMEOUT_MS = 10 * 1000;

/**
 * Push types after which the board or today's count has plausibly moved for this user. Anything
 * else (a pact invite, a reminder, a moment like) changes nothing the widget shows.
 */
const WIDGET_REFRESH_PUSH_TYPES: string[] = [
    PushNotifications.Types.partnerCheckedIn,
    PushNotifications.Types.partnerCelebrated,
    PushNotifications.Types.pactAccepted,
    PushNotifications.Types.pactCompleted,
    PushNotifications.Types.pactEnded,
    PushNotifications.Types.streakMilestone,
    PushNotifications.Types.streakAtRisk,
    PushNotifications.Types.streakBroken,
    PushNotifications.Types.leaderboardRankMilestone,
    PushNotifications.Types.weeklyRecap,
];

export const shouldRefreshWidgetForPush = (type: unknown): boolean => (
    typeof type === 'string' && WIDGET_REFRESH_PUSH_TYPES.includes(type)
);

interface IJsonResult {
    ok: boolean;
    status: number;
    data: any;
}

const getJson = async (
    path: string,
    session: { id: string; idToken: string; locale: string },
): Promise<IJsonResult> => {
    // Without a timeout a headless task is held open until the native side times it out,
    // which on Android leaves the widget on "Refreshing…" for the whole wait.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${getConfig().baseApiGatewayRoute}${path}`, {
            method: 'GET',
            // See backgroundCheckin.ts: RN's own AbortSignal declaration disagrees with the DOM
            // lib's, so the runtime-valid signal needs the cast.
            signal: controller.signal as unknown as RequestInit['signal'],
            headers: {
                authorization: `Bearer ${session.idToken}`,
                'x-userid': session.id,
                'x-platform': 'mobile',
                'x-localecode': session.locale,
                'x-brand-variation': CURRENT_BRAND_VARIATION,
            },
        });
        let data: any = null;
        try {
            data = await response.json();
        } catch {
            data = null;
        }
        return { ok: response.ok, status: response.status, data };
    } catch {
        // Network failure, timeout, or abort — all mean "keep the last snapshot".
        return { ok: false, status: 0, data: null };
    } finally {
        clearTimeout(timeoutId);
    }
};

const buildLeaderboardPath = (scope: HabitsWidgetScope): string => (
    `/users-service/users/leaderboards?scope=${scope}&period=week&limit=${WIDGET_TOP_ROWS}`
);

const buildTodayCheckinsPath = (): string => {
    // The device zone rides along for the same reason it does on the dashboard read: "today" is
    // the user's own day, which the service only knows from a saved zone a user who declined push
    // never has.
    const timeZone = getDeviceTimeZone();
    return `/users-service/habits/checkins/today${timeZone ? `?timeZone=${encodeURIComponent(timeZone)}` : ''}`;
};

const isBoard = (result: IJsonResult): boolean => result.ok && typeof result.data?.currentUser?.rank === 'number';

const asList = (value: any): any[] => (Array.isArray(value) ? value : []);

const refreshHabitsWidgetInBackground = async (
    { reason = 'periodic' }: { reason?: HabitsWidgetRefreshReason } = {},
): Promise<IHabitsWidgetRefreshResult> => {
    if (!isHabitsWidgetSupported()) {
        return { published: false, reason, skipped: 'unsupported' };
    }
    if (!(await hasHabitsWidgets())) {
        finishHabitsWidgetRefresh();
        return { published: false, reason, skipped: 'no-widgets' };
    }

    const { id, idToken, locale } = await readStoredSession();
    if (!id || !idToken) {
        finishHabitsWidgetRefresh();
        return { published: false, reason, skipped: 'no-session' };
    }
    const session = { id, idToken, locale };

    // The board the widget shows: friends, or the global board for a user with no one on
    // theirs — the same choice the dashboard makes in `refreshHabitsWidget`.
    const [friends, todayCheckins, goals, activePacts, pacts, userHabits] = await Promise.all([
        getJson(buildLeaderboardPath('connections'), session),
        getJson(buildTodayCheckinsPath(), session),
        getJson('/users-service/habits/goals', session),
        getJson('/users-service/habits/pacts/active', session),
        getJson('/users-service/habits/pacts', session),
        getJson('/users-service/habits/user-habits', session),
    ]);

    const results = [friends, todayCheckins, goals, activePacts, pacts];
    if (results.some((result) => result.status === 401)) {
        finishHabitsWidgetRefresh();
        return { published: false, reason, skipped: 'unauthorized' };
    }
    // The tracking registry is the one input the dashboard tolerates losing (it drops the
    // archived filter rather than the refresh), so it is the one input tolerated here.
    if (!isBoard(friends) || results.slice(1).some((result) => !result.ok)) {
        finishHabitsWidgetRefresh();
        return { published: false, reason, skipped: 'request-failed' };
    }

    let board: IHabitsWidgetLeaderboardResponse = friends.data;
    let scope: HabitsWidgetScope = 'connections';
    if (!hasFriendsOnBoard(board)) {
        const global = await getJson(buildLeaderboardPath('global'), session);
        if (!isBoard(global)) {
            finishHabitsWidgetRefresh();
            return { published: false, reason, skipped: global.status === 401 ? 'unauthorized' : 'request-failed' };
        }
        board = global.data;
        scope = 'global';
    }

    const { live } = splitHabitsByPactState(
        asList(goals.data),
        asList(activePacts.data),
        asList(pacts.data),
        id,
        userHabits.ok ? asList(userHabits.data?.userHabits) : [],
    );

    const published = publishHabitsWidget(
        buildHabitsWidgetSnapshot(
            board,
            scope,
            countTodayProgress(live, asList(todayCheckins.data)),
            (key: string, params?: any) => translator(locale, key, params),
        ),
        { force: true },
    );
    if (!published) {
        finishHabitsWidgetRefresh();
    }

    return { published, reason };
};

export default refreshHabitsWidgetInBackground;
