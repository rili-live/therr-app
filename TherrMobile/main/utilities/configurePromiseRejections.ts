import { getCrashlytics, log, recordError } from '@react-native-firebase/crashlytics';

// RN installs a rejection tracker in `polyfillPromise.js`. On Hermes it uses
// `HermesInternal.enablePromiseRejectionTracker(...)`; on the JS polyfill it
// uses `promise/setimmediate/rejection-tracking`. Either way the default
// handler routes through `ExceptionsManager.handleException` and spams
// `Uncaught (in promise, id: N)` to the console. We override with a gentler
// handler so rejections are still visible but don't trigger the RedBox /
// console.error path.
//
//   - dev: log a grouped warning (no RedBox)
//   - prod: report to Crashlytics as a non-fatal so the rejection is still
//           searchable, without surfacing to the user

const formatReason = (reason: any): string => {
    if (reason == null) return 'Unknown rejection';
    if (typeof reason === 'string') return reason;
    if (reason?.message && reason?.statusCode) {
        return `${reason.statusCode}: ${reason.message}`;
    }
    if (reason?.message) return reason.message;
    try {
        return JSON.stringify(reason);
    } catch {
        return String(reason);
    }
};

const onUnhandled = (id: number, rejection: any) => {
    if (__DEV__) {
        console.warn(`[UnhandledPromiseRejection #${id}]`, formatReason(rejection), rejection);
        return;
    }
    try {
        const crashlytics = getCrashlytics();
        log(crashlytics, `UnhandledPromiseRejection #${id}: ${formatReason(rejection)}`);
        const err = rejection instanceof Error
            ? rejection
            : new Error(formatReason(rejection));
        recordError(crashlytics, err);
    } catch {
        // Crashlytics may not be initialized during very early startup.
    }
};

const onHandled = (id: number) => {
    if (__DEV__) {
        console.warn(`[UnhandledPromiseRejection #${id}] was handled late — investigate.`);
    }
};

const configurePromiseRejections = (): void => {
    const options = { allRejections: true, onUnhandled, onHandled };

    // Hermes exposes its own tracker. RN only enables it in __DEV__, so in
    // prod on Hermes we install our own so we still get Crashlytics reports.
    const hermesTracker = (global as any)?.HermesInternal?.enablePromiseRejectionTracker;
    if (typeof hermesTracker === 'function') {
        hermesTracker(options);
        return;
    }

    // JS polyfill path (non-Hermes, e.g. JSC).
    try {
        const tracking = require('promise/setimmediate/rejection-tracking');
        tracking.disable();
        tracking.enable(options);
    } catch {
        // No-op: no tracker available; rejections will fall through silently.
    }
};

export default configurePromiseRejections;
