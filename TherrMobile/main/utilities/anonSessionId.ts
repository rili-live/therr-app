import SecureStorage from './SecureStorage';

const STORAGE_KEY = 'therrAnonSessionId';

/**
 * UUID v4 shape, generated with Math.random.
 *
 * This is not a secret and is not used for authentication: the API gateway
 * salts it together with the request IP and hashes the pair to bucket
 * anonymous correction submissions. Collision resistance is all that matters,
 * and there is no CSPRNG in the JS bundle today (no react-native-get-random-values).
 */
const generateUuid = (): string => {
    /* eslint-disable no-bitwise */
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
    /* eslint-enable no-bitwise */
};

/**
 * Returns a stable per-install UUID identifying an anonymous submitter of
 * crowdsourced space corrections, creating one on first use.
 *
 * Mirrors `getOrCreateAnonSessionId` in therr-client-web (which is backed by
 * localStorage). Sent as the `x-anon-session-id` header; the gateway rejects
 * unauthenticated submissions without it.
 *
 * Returns an empty string if storage is unavailable rather than throwing —
 * the caller surfaces that as a normal submission error.
 */
const getOrCreateAnonSessionId = async (): Promise<string> => {
    try {
        const existing = await SecureStorage.getItem(STORAGE_KEY);
        if (existing) {
            return existing;
        }
        const fresh = generateUuid();
        await SecureStorage.setItem(STORAGE_KEY, fresh);
        return fresh;
    } catch {
        return '';
    }
};

export default getOrCreateAnonSessionId;
