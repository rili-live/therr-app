const STORAGE_KEY = 'therr.anonSessionId';

const generateUuid = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback for older browsers; format matches RFC 4122 v4 visually but uses
    // Math.random — only triggered on browsers that lack crypto.randomUUID
    // (vanishingly rare today). Bitwise ops are the canonical UUID v4 recipe.
    /* eslint-disable no-bitwise */
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
    /* eslint-enable no-bitwise */
};

// Returns a stable per-browser UUID used to identify anonymous submitters of
// crowdsourced corrections. SSR-safe: returns empty string when window is not
// available (the server never submits corrections).
const getOrCreateAnonSessionId = (): string => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return '';
    }
    try {
        const existing = window.localStorage.getItem(STORAGE_KEY);
        if (existing) return existing;
        const fresh = generateUuid();
        window.localStorage.setItem(STORAGE_KEY, fresh);
        return fresh;
    } catch {
        // Some browsers throw on localStorage access in private mode.
        return '';
    }
};

export default getOrCreateAnonSessionId;
