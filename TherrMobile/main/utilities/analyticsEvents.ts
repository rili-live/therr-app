import { getAnalytics, logEvent } from '@react-native-firebase/analytics';

/**
 * The one way this app records an analytics event.
 *
 * WHY IT IS A HELPER RATHER THAN A CALL
 * Every call site wants the same two things and neither is the default:
 *
 *   1. **Failure is swallowed, synchronous and asynchronous alike.** `logEvent`
 *      rejects when the SDK has not finished initializing, when the device has
 *      no Play services, and when the user has opted out of collection. It also
 *      *throws*, before it ever returns a promise, on a name it considers
 *      reserved or malformed — and `getAnalytics()` throws outright when the
 *      default Firebase app has not been created yet, which on Android is a
 *      cold-start race rather than a configuration error. A `.catch()` alone
 *      only covers the rejecting half; the throwing half would escape into
 *      whatever called this. That matters because the call sites are a
 *      check-in's `.then()`, a purchase's success path, and the paywall's
 *      `componentDidMount`: an escape there does not lose an event, it fails a
 *      check-in the server already recorded, or blanks the one screen the app
 *      earns money on. None of those is an error the user caused or could act
 *      on. Measurement never gets to break the thing it measures.
 *   2. **Undefined params are dropped.** Nearly every event here carries
 *      `userId`, read off a user record that a background or push-driven path
 *      may not have loaded yet. Firebase records `undefined` as the string
 *      "undefined" rather than omitting the key, which quietly turns a missing
 *      value into a populated wrong one — and a funnel grouped on it then
 *      reports a cohort that does not exist.
 *
 * Written out at each call site those two are easy to get subtly different, and
 * the difference is invisible until a report is already wrong.
 */
export const logAppEvent = (name: string, params: Record<string, any> = {}): void => {
    try {
        const defined = Object.keys(params).reduce((acc: Record<string, any>, key) => {
            if (params[key] !== undefined && params[key] !== null) {
                acc[key] = params[key];
            }
            return acc;
        }, {});

        logEvent(getAnalytics(), name, defined).catch((err) => console.log(err));
    } catch (err) {
        // Deliberately the same treatment as a rejection: log it and return.
        // See the note above on why a throw here must not reach the caller.
        console.log(err);
    }
};

export default logAppEvent;
