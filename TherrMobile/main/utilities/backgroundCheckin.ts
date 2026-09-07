import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';
import getConfig from './getConfig';
import SecureStorage from './SecureStorage';

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
 * start (SecureStorage → Keychain, `AFTER_FIRST_UNLOCK`, so it is readable
 * from a push wake) and issues one plain `fetch`.
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
}

const REQUEST_TIMEOUT_MS = 10 * 1000;

export const buildCheckinUrl = (baseApiGatewayRoute: string): string => `${baseApiGatewayRoute}/users-service/habits/checkins`;

const readSession = async (): Promise<{ id?: string; idToken?: string; locale: string }> => {
    const [userJson, settingsJson] = await Promise.all([
        SecureStorage.getItem('therrUser').catch(() => null),
        SecureStorage.getItem('therrUserSettings').catch(() => null),
    ]);

    let user: any = {};
    let settings: any = {};
    try {
        user = JSON.parse(userJson || '{}');
    } catch {
        user = {};
    }
    try {
        settings = JSON.parse(settingsJson || '{}');
    } catch {
        settings = {};
    }

    return { id: user?.id, idToken: user?.idToken, locale: settings?.locale || 'en-us' };
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
}: IBackgroundCheckinArgs): Promise<IBackgroundCheckinResult> => {
    const { id, idToken, locale } = await readSession();

    if (!habitGoalId || !id || !idToken) {
        return { didCheckIn: false, locale };
    }

    // Without a timeout a background handler can be held open until the OS kills
    // it, which on Android costs the notification update the caller is waiting
    // to post.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(buildCheckinUrl(getConfig().baseApiGatewayRoute), {
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
                authorization: `Bearer ${idToken}`,
                'x-userid': id,
                'x-platform': 'mobile',
                'x-localecode': locale,
                'x-brand-variation': CURRENT_BRAND_VARIATION,
            },
            body: JSON.stringify({
                habitGoalId,
                // Omitted rather than sent as undefined: the handler resolves
                // the active pacts backing the goal itself when none is given,
                // which is the correct behaviour for a habit in several pacts.
                ...(pactId ? { pactId } : {}),
                status: 'completed',
            }),
        });

        return { didCheckIn: response.ok, locale };
    } catch {
        // Network failure, timeout, or abort — all indistinguishable from the
        // caller's point of view, and all mean "open the app instead".
        return { didCheckIn: false, locale };
    } finally {
        clearTimeout(timeoutId);
    }
};

export default completeCheckinInBackground;
