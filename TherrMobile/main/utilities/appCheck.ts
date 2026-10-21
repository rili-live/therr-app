import { Platform } from 'react-native';

/**
 * Firebase App Check for the requests that cost us a text message.
 *
 * The gateway texts a verification code only at its normal limits when the request carries a
 * valid App Check token; without one it falls back to a strict lane (US/Canada only, a small
 * hourly budget) — see `therr-api-gateway/src/services/phone/appAttestation.ts`. That is what
 * stops SMS pumping scripts, which never run inside the real app.
 *
 * Android only for now (Play Integrity). iOS sends no token and gets the strict lane until App
 * Attest is wired up — see docs/APP_CHECK.md before enabling it, because it needs Xcode and
 * provisioning changes as well as this file.
 *
 * Every failure here is swallowed: a missing token only costs the strict lane, whereas a thrown
 * error would block sign-in outright. For the same reason the Firebase modules are required
 * lazily: `@react-native-firebase/app` constructs a native event emitter at import time, and
 * this file sits on `interceptors.ts`'s import path, so a top-level import would take every
 * screen down with it (and Jest) if the native module were ever missing.
 */

/** Must match `APP_CHECK_HEADER` in the gateway. */
export const APP_CHECK_HEADER = 'x-firebase-appcheck';

/** The gateway routes that send a verification text. Matched on the whole path, like `authRequestPaths`. */
export const APP_CHECK_PATHS = [
    '/phone/register/start',
    '/phone/auth/start',
    '/phone/verify',
];

// Play Integrity's first verdict on a device can take a few seconds. Past this the request goes
// without a token rather than leaving the user staring at a spinner.
const TOKEN_TIMEOUT_MS = 5000;

export const needsAppCheckToken = (url = '') => {
    const path = (url || '').split('?')[0].replace(/\/+$/, '');

    return APP_CHECK_PATHS.some((appCheckPath) => path === appCheckPath || path.endsWith(appCheckPath));
};

let appCheckInstance: Promise<any> | undefined;

const getAppCheck = () => {
    if (!appCheckInstance) {
        const { getApp } = require('@react-native-firebase/app');
        const { initializeAppCheck, ReactNativeFirebaseAppCheckProvider } = require('@react-native-firebase/app-check');
        const provider = new ReactNativeFirebaseAppCheckProvider();
        provider.configure({
            // Debug builds use the debug provider: register the token it logs in the Firebase
            // console (App Check → Manage debug tokens), or local sign-in gets the strict lane.
            android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
        });

        // Tokens are fetched on demand, a handful of times per install, rather than kept fresh in
        // the background — which would spend Play Integrity quota on every session for nothing.
        appCheckInstance = initializeAppCheck(getApp(), { provider, isTokenAutoRefreshEnabled: false })
            .catch(() => {
                appCheckInstance = undefined;
                return undefined;
            });
    }

    return appCheckInstance;
};

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | undefined> => new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise
        .then((value) => resolve(value))
        .catch(() => resolve(undefined))
        .finally(() => clearTimeout(timer));
});

/** An App Check token, or `undefined` on iOS, on any failure, or after `TOKEN_TIMEOUT_MS`. */
export const getAppCheckToken = async (): Promise<string | undefined> => {
    if (Platform.OS !== 'android') {
        return undefined;
    }

    const result = await withTimeout((async () => {
        const appCheck = await getAppCheck();
        const { getToken } = require('@react-native-firebase/app-check');

        return appCheck ? getToken(appCheck, false) : undefined;
    })(), TOKEN_TIMEOUT_MS);

    return result?.token || undefined;
};
