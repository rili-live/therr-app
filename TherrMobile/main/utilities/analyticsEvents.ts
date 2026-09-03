import { getAnalytics, logEvent } from '@react-native-firebase/analytics';

/**
 * The one way this app records an analytics event.
 *
 * WHY IT IS A HELPER RATHER THAN A CALL
 * Every call site wants the same two things and neither is the default:
 *
 *   1. **Failure is swallowed.** `logEvent` rejects when the SDK has not
 *      finished initializing, when the device has no Play services, and when
 *      the user has opted out of collection. None of those is an error the user
 *      caused or could act on, and an unhandled rejection inside a check-in or
 *      a purchase would surface as that action failing. Measurement never gets
 *      to break the thing it measures.
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
    const defined = Object.keys(params).reduce((acc: Record<string, any>, key) => {
        if (params[key] !== undefined && params[key] !== null) {
            acc[key] = params[key];
        }
        return acc;
    }, {});

    logEvent(getAnalytics(), name, defined).catch((err) => console.log(err));
};

export default logAppEvent;
