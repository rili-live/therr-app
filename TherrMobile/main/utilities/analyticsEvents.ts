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
 *   3. **Booleans are sent as strings.** Firebase's own typed event-parameter
 *      interfaces constrain a custom param to `string | number`
 *      (`EventParams[key]` in `@react-native-firebase/analytics`), and the
 *      Android bridge hands a JS boolean to `FirebaseAnalytics.logEvent` as
 *      `Bundle.putBoolean`, which is outside the set the SDK accepts. Nothing
 *      rejects: the library's own docs note that parameter limits are applied
 *      "during cloud processing" and that "the errors will not be seen as
 *      Promise rejections", so an unsupported param is dropped somewhere
 *      between the device and the report. `hasProof` and `isRecovery` would
 *      simply never arrive, and their absence is indistinguishable in GA4 from
 *      an event nobody fired. Coercing here keeps every call site writing the
 *      boolean it means.
 *
 * Written out at each call site these are easy to get subtly different, and
 * the difference is invisible until a report is already wrong.
 */
export const logAppEvent = (name: string, params: Record<string, any> = {}): void => {
    try {
        const defined = Object.keys(params).reduce((acc: Record<string, any>, key) => {
            const value = params[key];
            if (value !== undefined && value !== null) {
                // See note 3 above. Only booleans are rewritten — a number stays a
                // number, because GA4 can only aggregate (sum, average) a param it
                // received as one, and `value` on the purchase event is the whole
                // reason that event carries a value at all.
                acc[key] = typeof value === 'boolean' ? String(value) : value;
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
