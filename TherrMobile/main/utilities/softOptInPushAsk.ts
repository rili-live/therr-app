import AsyncStorage from '@react-native-async-storage/async-storage';

const STATE_KEY = '@therr/softOptInPush/state';
const DEFERRED_UNTIL_KEY = '@therr/softOptInPush/deferredUntil';

export type SoftOptInState = 'never_shown' | 'deferred' | 'accepted' | 'denied';

const DEFAULT_DEFER_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

const readState = async (): Promise<SoftOptInState> => {
    const value = await AsyncStorage.getItem(STATE_KEY);
    if (value === 'deferred' || value === 'accepted' || value === 'denied') {
        return value;
    }
    return 'never_shown';
};

const readDeferredUntil = async (): Promise<number> => {
    const value = await AsyncStorage.getItem(DEFERRED_UNTIL_KEY);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const shouldShowSoftAsk = async (): Promise<boolean> => {
    const state = await readState();
    if (state === 'accepted' || state === 'denied') {
        return false;
    }
    if (state === 'deferred') {
        const deferredUntil = await readDeferredUntil();
        return Date.now() >= deferredUntil;
    }
    return true;
};

export const markSoftOptInDeferred = async (deferMs: number = DEFAULT_DEFER_MS): Promise<void> => {
    await AsyncStorage.setItem(STATE_KEY, 'deferred');
    await AsyncStorage.setItem(DEFERRED_UNTIL_KEY, String(Date.now() + deferMs));
};

export const markSoftOptInAccepted = async (): Promise<void> => {
    await AsyncStorage.setItem(STATE_KEY, 'accepted');
    await AsyncStorage.removeItem(DEFERRED_UNTIL_KEY);
};

export const markSoftOptInDenied = async (): Promise<void> => {
    await AsyncStorage.setItem(STATE_KEY, 'denied');
    await AsyncStorage.removeItem(DEFERRED_UNTIL_KEY);
};
