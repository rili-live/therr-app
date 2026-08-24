import type { MMKV } from 'react-native-mmkv';

/**
 * Sticky, per-user record of "this account has started using habits".
 *
 * WHY THIS EXISTS
 *
 * `PactOnboardingGuard` decides whether to render the onboarding overlay from
 * the `habits` Redux slice, and that slice is not in the redux-persist
 * whitelist (see `therr-react/redux/persistConfig`). On a cold start it is
 * therefore empty until `getUserPacts`/`getUserGoals` resolve, so the guard
 * answers "has this user started?" with a false negative and flashes the
 * full-screen call-to-action at an established user for the length of a network
 * round trip, then swaps it for the dashboard.
 *
 * A synchronous read is what removes the flash — the answer has to be available
 * during the first render, which rules out AsyncStorage. MMKV reads are
 * memory-mapped and synchronous, so this resolves before the first paint.
 *
 * WHY IT IS STICKY, AND WHY THAT IS SAFE
 *
 * The flag is only ever written once the *server-backed* state has said the
 * user started, and it is never cleared when their habits go away. That makes
 * it one-way: a user who has started can never be shown onboarding again, even
 * if they later abandon every pact. That is the desired trade — the dashboard's
 * own empty state already carries a "Start a Pact" call to action for that
 * case, whereas a re-appearing full-screen overlay reads as data loss.
 *
 * Keyed by user id so a device shared between accounts (or a fresh account on a
 * device that has already onboarded another) still gets the real overlay. There
 * is deliberately no clear-on-logout: logging back in as the same user does not
 * un-start their habits, and clearing would reintroduce the flash for them.
 *
 * MMKV is a JSI module, so it is required lazily inside a try/catch — the same
 * rule `rewardFeedback.ts` follows. An unrebuilt native project (or Jest) then
 * degrades to "no cached answer", which is exactly today's behaviour, rather
 * than crashing at import time.
 */

const STORAGE_ID = 'therr-storage';
const KEY_PREFIX = 'habits:hasStarted:';

// `undefined` = not yet attempted, `null` = attempted and unavailable.
let storage: MMKV | null | undefined;

const getStorage = (): MMKV | null => {
    if (storage !== undefined) {
        return storage;
    }

    // Resolved into a local first so the return type stays `MMKV | null` —
    // assigning to the memo directly leaves TS holding the `undefined` arm.
    let resolved: MMKV | null;
    try {
        const { MMKV: MMKVConstructor } = require('react-native-mmkv');
        resolved = new MMKVConstructor({ id: STORAGE_ID });
    } catch {
        resolved = null;
    }
    storage = resolved;

    return resolved;
};

const getKey = (userId?: string): string | null => (userId ? `${KEY_PREFIX}${userId}` : null);

/**
 * Has this user been recorded as having started? `false` whenever there is no
 * user id, no MMKV, or nothing stored — all of which mean "fall back to the
 * live Redux answer".
 */
export const hasStartedHabitsCached = (userId?: string): boolean => {
    const key = getKey(userId);
    const store = key && getStorage();

    if (!key || !store) {
        return false;
    }

    try {
        return store.getBoolean(key) === true;
    } catch {
        return false;
    }
};

/**
 * Record that this user has started. Reads before writing so a re-render storm
 * cannot turn this into a write per render.
 */
export const rememberHabitsStarted = (userId?: string): void => {
    const key = getKey(userId);
    const store = key && getStorage();

    if (!key || !store) {
        return;
    }

    try {
        if (store.getBoolean(key) !== true) {
            store.set(key, true);
        }
    } catch {
        // Best-effort cache; a failed write only costs the next cold start a flash.
    }
};

/**
 * Drop the record for one user. Not part of the normal lifecycle — exposed for
 * account deletion and for tests.
 */
export const forgetHabitsStarted = (userId?: string): void => {
    const key = getKey(userId);
    const store = key && getStorage();

    if (!key || !store) {
        return;
    }

    try {
        store.delete(key);
    } catch {
        // no-op
    }
};
