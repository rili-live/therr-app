import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';
import getConfig from './getConfig';
import readStoredSession, { IStoredSession } from './storedSession';

/**
 * Completes a habit check-in straight from a notification action, without
 * opening the app.
 *
 * ## Why this does not use `axios` / `HabitCheckinsService`
 *
 * Those depend on `initInterceptors` (main/interceptors.ts), which runs from
 * `App.tsx` and therefore only when the React tree is mounted. Notifee's
 * background event handler runs in the headless JS context — the app process
 * may never have rendered anything — so `axios.defaults.baseURL` is unset and
 * the request interceptor that attaches `authorization` from the Redux store
 * was never registered. A check-in built on that stack works when the app
 * happens to be warm and silently no-ops when it is not, which is the opposite
 * of what a tray action is for.
 *
 * So this reads the session from the same place `getStore` reads it at cold
 * start (`readStoredSession`: SecureStorage → Keychain, `AFTER_FIRST_UNLOCK`,
 * so it is readable from a push wake) and issues one plain `fetch`.
 *
 * ## Failure is not silent
 *
 * Every failure path returns `false` so the caller can fall back to opening the
 * app at the habit. A tray button that reports nothing and does nothing is
 * worse than one that opens a screen.
 */

export interface IBackgroundCheckinArgs {
    habitGoalId: string;
    /** Optional: attributes the check-in to a pact when the notification named one. */
    pactId?: string;
    /**
     * Raw text from the notification's amount field, on a savings habit.
     *
     * Passed through **unparsed and untrimmed**. The server applies the shared
     * `parseSavingsAmount`, which accepts "$20", "20,00" and " 20 " alike, and it is the
     * only validator with the authority to reject one — so parsing here as well would
     * add a second opinion that could disagree with it and drop a number the user typed.
     * Omitted entirely when the user submitted an empty field, which records the
     * check-in with no amount rather than clearing anything.
     */
    savedAmount?: string;
    /**
     * The `main.notificationQueue` row the pressed push was sent from, when it was queued.
     * The press is reported as that send's open (docs/NOTIFICATION_QUEUE_DESIGN.md → "Open tracking").
     */
    notificationQueueId?: string;
    /** The press action id, recorded as the open's `openAction`. */
    pressActionId?: string;
}

const REQUEST_TIMEOUT_MS = 10 * 1000;

export const buildCheckinUrl = (baseApiGatewayRoute: string): string => `${baseApiGatewayRoute}/users-service/habits/checkins`;

export const buildPushOpenUrl = (baseApiGatewayRoute: string): string => `${baseApiGatewayRoute}/users-service/users/notifications/push-opens`;

/**
 * One authenticated JSON POST from the headless context. Resolves whether the server
 * accepted it; never rejects.
 */
const postInBackground = async (url: string, session: IStoredSession, body: Record<string, unknown>): Promise<boolean> => {
    // Without a timeout a background handler can be held open until the OS kills
    // it, which on Android costs the notification update the caller is waiting
    // to post.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'POST',
            // React Native ships its own `AbortSignal` declaration alongside the
            // DOM lib, and the two disagree on `onabort` nullability — so the
            // signal a `new AbortController()` produces does not typecheck
            // against RN's `RequestInit`. The runtime supports it; only the
            // declarations conflict. Cast to RN's own type rather than `any` so
            // a real mismatch here would still be caught.
            signal: controller.signal as unknown as RequestInit['signal'],
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${session.idToken}`,
                'x-userid': session.id as string,
                'x-platform': 'mobile',
                'x-localecode': session.locale,
                'x-brand-variation': CURRENT_BRAND_VARIATION,
            },
            body: JSON.stringify(body),
        });

        return response.ok;
    } catch {
        // Network failure, timeout, or abort — all indistinguishable from the
        // caller's point of view, and all mean "open the app instead".
        return false;
    } finally {
        clearTimeout(timeoutId);
    }
};

export interface IBackgroundCheckinResult {
    didCheckIn: boolean;
    /**
     * The stored user's locale, returned so the caller can render its
     * confirmation in it. The headless context has no Redux store to read it
     * from, and this function has already paid for the SecureStorage read.
     */
    locale: string;
}

/**
 * Reports success only when the server confirms the check-in.
 *
 * An expired token is indistinguishable from a missing one here — there is no
 * refresh flow in the headless context, and quietly attempting one would risk
 * rotating the refresh token outside the interceptor that tracks it. Both cases
 * therefore fall back to opening the app, where the normal 401 handling runs.
 */
const completeCheckinInBackground = async ({
    habitGoalId,
    pactId,
    savedAmount,
    notificationQueueId,
    pressActionId,
}: IBackgroundCheckinArgs): Promise<IBackgroundCheckinResult> => {
    const session = await readStoredSession();
    const { id, idToken, locale } = session;

    if (!id || !idToken) {
        return { didCheckIn: false, locale };
    }

    const { baseApiGatewayRoute } = getConfig();

    // Open tracking: in the app, a press on a queued push is reported by Layout's
    // notifee handler (`reportPushOpen`). On a killed app that handler does not exist —
    // this one runs instead — so without this the most valuable press a reminder gets,
    // the check-in itself, reads as an unopened send in `main.notificationQueue`.
    // Started alongside the check-in rather than after it, so it adds no latency to the
    // confirmation the user is waiting for, and it can never change the check-in result.
    // Reported even when the check-in cannot be attempted: the press still happened.
    const openReport = notificationQueueId
        ? postInBackground(buildPushOpenUrl(baseApiGatewayRoute), session, {
            notificationQueueId,
            pressActionId: pressActionId || 'default',
        })
        : Promise.resolve(false);

    const didCheckIn = habitGoalId
        ? await postInBackground(buildCheckinUrl(baseApiGatewayRoute), session, {
            habitGoalId,
            // Omitted rather than sent as undefined: the handler resolves
            // the active pacts backing the goal itself when none is given,
            // which is the correct behaviour for a habit in several pacts.
            ...(pactId ? { pactId } : {}),
            // Same reasoning as `pactId`: omitted rather than sent empty. An
            // explicit empty value would *clear* an amount already recorded for
            // today, so a user who submitted the quick-reply without typing
            // anything would erase what they logged in the app this morning.
            ...(savedAmount && savedAmount.trim().length ? { savedAmount } : {}),
            status: 'completed',
        })
        : false;

    // Awaited before returning because the headless task may be torn down once the
    // handler resolves, which would drop a report still in flight.
    await openReport;

    return { didCheckIn, locale };
};

export default completeCheckinInBackground;
