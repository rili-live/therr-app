import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Play Install Referrer -> the `userAcquisition` record the API already accepts.
 *
 * THE GAP THIS CLOSES
 * A Google App campaign sends the user to the Play Store. They never load a
 * page we control, so nothing sets a UTM in a browser and
 * `main."userAcquisition"` records nothing for a paid install — the account is
 * indistinguishable from an organic one, and every claim about what bought
 * users do is inference. The Play Install Referrer API is the one channel that
 * carries the campaign across that hop.
 *
 * The server half already exists and needs no change:
 * `sanitizeUserAcquisition` (users-service/store/UserAcquisitionStore.ts) drops
 * unknown keys and truncates to column width, and the registration handler
 * writes it fire-and-forget after the account exists.
 *
 * SHAPE PARITY
 * The object built here is `IUserAcquisition` from
 * therr-react/utilities/attribution.ts, minus the fields that only mean
 * something in a browser. It is constructed by hand rather than imported
 * because that module reaches for `window` and `sessionStorage` at call time.
 * Field names and caps are mirrored, and a test asserts they stay mirrored.
 *
 * EVERYTHING HERE IS ADVISORY
 * No Play services, an old Play Store, an organic install, a sideloaded debug
 * build, or storage failing all produce "no attribution", which is a normal and
 * correct answer. Nothing in this file may reject, and nothing may delay a
 * registration.
 */

/** Mirrors MAX_UTM_LENGTH in therr-react/utilities/attribution.ts. */
const MAX_UTM_LENGTH = 255;
/** Mirrors MAX_REFERRER_LENGTH. */
const MAX_REFERRER_LENGTH = 1024;

/**
 * Read once, ever. The referrer stays available from Play for the life of the
 * install, but a user can reach registration more than once (sign out, a failed
 * first attempt), and re-reading is a needless service binding each time. The
 * flag is separate from the value so "read it and there was nothing" is
 * distinguishable from "never read it".
 */
const STORAGE_KEY = 'therrInstallReferrer';
const STORAGE_READ_FLAG = 'therrInstallReferrerRead';

/**
 * How long to wait on Play before treating the read as a failure.
 *
 * `InstallReferrerClient` reports its outcomes through a listener, and the
 * listener is not guaranteed to fire: the binding can be accepted by a Play
 * Store that then never answers. The native side resolves the promise on every
 * outcome it is *told* about, but silence is not an outcome, and this promise is
 * awaited on the registration submit path with the button already disabled — an
 * unbounded wait there is a sign-up that never completes and cannot be retried
 * without killing the app.
 *
 * Timing out rejects rather than resolving null on purpose: the outer catch then
 * returns null without writing the read flag, so a device that was merely slow
 * gets another attempt instead of being cached as "no attribution" forever.
 */
const NATIVE_READ_TIMEOUT_MS = 3000;

const readWithTimeout = (read: Promise<any>): Promise<any> => new Promise((resolve, reject) => {
    const timer = setTimeout(
        () => reject(new Error('installReferrerTimeout')),
        NATIVE_READ_TIMEOUT_MS,
    );

    read.then(
        (value) => {
            clearTimeout(timer);
            resolve(value);
        },
        (error) => {
            clearTimeout(timer);
            reject(error);
        },
    );
});

export interface IMobileUserAcquisition {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    referrer?: string;
    surface: 'mobile';
}

const UTM_KEYS: [keyof IMobileUserAcquisition, string][] = [
    ['utmSource', 'utm_source'],
    ['utmMedium', 'utm_medium'],
    ['utmCampaign', 'utm_campaign'],
    ['utmContent', 'utm_content'],
    ['utmTerm', 'utm_term'],
];

const truncate = (value: string | null | undefined, max: number): string | undefined => {
    if (!value) return undefined;
    const trimmed = String(value).trim();
    return trimmed ? trimmed.slice(0, max) : undefined;
};

/**
 * Turn Play's referrer string into an acquisition record, or null.
 *
 * The string is `application/x-www-form-urlencoded`, e.g.
 *   utm_source=google-play&utm_medium=organic
 *   utm_source=google&utm_medium=cpc&utm_campaign=fwh-app-us-installs-2026q3
 *
 * Two values are deliberately NOT treated as attribution:
 *   `utm_source=google-play&utm_medium=organic` — Play's own placeholder for an
 *     install that came from browsing the store. Recording it would relabel
 *     every organic install as a campaign named "google-play".
 *   `not%20set` / `not set` — what Play returns when it has nothing.
 *
 * Exported and pure so the parsing rules are testable without an emulator,
 * which is the only way they get tested at all.
 */
export const parseInstallReferrer = (referrer?: string | null): IMobileUserAcquisition | null => {
    const raw = truncate(referrer, MAX_REFERRER_LENGTH);

    if (!raw || raw === 'not set' || raw === 'not%20set') return null;

    const acquisition: IMobileUserAcquisition = { surface: 'mobile' };
    // URLSearchParams handles the + -> space and percent decoding that a manual
    // split does not, and is available in React Native's runtime.
    const params = new URLSearchParams(raw);

    UTM_KEYS.forEach(([field, param]) => {
        const value = truncate(params.get(param), MAX_UTM_LENGTH);
        if (value) {
            (acquisition as any)[field] = value;
        }
    });

    const isPlayOrganic = acquisition.utmSource === 'google-play' && acquisition.utmMedium === 'organic';

    if (isPlayOrganic || !acquisition.utmSource) {
        // No campaign in it. Keep the raw string anyway when it carried
        // something other than Play's placeholder — an unrecognised referrer is
        // still evidence about where installs come from, and the column exists.
        if (isPlayOrganic) return null;
        acquisition.referrer = raw;
        return acquisition;
    }

    acquisition.referrer = raw;

    return acquisition;
};

/**
 * The install referrer for this device, read from Play at most once.
 *
 * Android only: iOS has no equivalent and the module is not registered there.
 * Resolves null on every failure path — see the module docstring.
 */
export const getInstallAcquisition = async (): Promise<IMobileUserAcquisition | null> => {
    if (Platform.OS !== 'android') return null;

    try {
        const alreadyRead = await AsyncStorage.getItem(STORAGE_READ_FLAG);

        if (alreadyRead) {
            const cached = await AsyncStorage.getItem(STORAGE_KEY);
            return cached ? JSON.parse(cached) : null;
        }

        const pendingRead = NativeModules.InstallReferrer?.getInstallReferrer?.();
        const result = pendingRead ? await readWithTimeout(Promise.resolve(pendingRead)) : null;
        const acquisition = parseInstallReferrer(result?.referrer);

        // Value first, flag second. The flag is what makes this read happen once
        // ever, so writing it before the value it vouches for means a process
        // killed between the two lands on "already read, nothing there" and
        // discards a paid install's attribution permanently. In this order the
        // same kill leaves the flag unset and the next launch simply reads Play
        // again, which is the cheap half of the pair.
        if (acquisition) {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(acquisition));
        }
        await AsyncStorage.setItem(STORAGE_READ_FLAG, 'true');

        return acquisition;
    } catch {
        // A missing module, a disabled Play Store, storage refusing to write.
        // None of them is a reason to fail whatever asked for this.
        return null;
    }
};
