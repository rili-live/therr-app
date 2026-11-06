import { Platform } from 'react-native';

/**
 * Whether this launch is a Firebase Test Lab run — which is what Google Play's pre-launch report
 * is. Play installs every new release on a lab of devices (a `OnePlus8Pro` and `sdk_gphone*`
 * emulators among them) and launches it, and each of those launches used to land in GA4 as a new
 * user on that release's version: ~70 fake new users in October 2026 against ~25 real installs a
 * week.
 *
 * Test Lab marks its devices with the Android system setting `firebase.test.lab = "true"`.
 * @react-native-firebase/app already reads it into a synchronous native constant
 * (`utils().isRunningInTestLab`, always false on iOS), so no native code of our own is needed.
 *
 * Never throws: a failure to read the flag must not take analytics — or app start — down with it.
 */
export const isRunningInFirebaseTestLab = (): boolean => {
    if (Platform.OS !== 'android') {
        return false;
    }

    try {
        const { utils } = require('@react-native-firebase/app');

        return utils().isRunningInTestLab === true;
    } catch {
        return false;
    }
};

/**
 * Debug builds and Test Lab runs never report analytics. Everything else does.
 *
 * Query-time exclusion of the same devices (`SYNTHETIC_DEVICE_MODELS` in
 * scripts/google-ads/therr_ads/ga4.py) stays as the backstop for history and for any lab run that
 * slips past this gate.
 */
export const shouldCollectAnalytics = (isDev: boolean, isTestLab: boolean): boolean => !isDev && !isTestLab;
