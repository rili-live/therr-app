import axios from 'axios';

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if an error is a network/offline error (no server response).
 */
const isOfflineError = (error: any): boolean => {
    if (!error) return false;

    // Axios network error (no response received)
    if (axios.isAxiosError?.(error) && !error.response) {
        return true;
    }

    // Standard network error codes
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
        return true;
    }

    // TypeError from fetch API when offline
    if (error instanceof TypeError && error.message === 'Network request failed') {
        return true;
    }

    return false;
};

/**
 * Check if cached data is stale based on a timestamp.
 */
const isCacheStale = (lastFetchedAt: number | null | undefined, maxAgeMs: number = DEFAULT_MAX_AGE_MS): boolean => {
    if (!lastFetchedAt) return true;
    return (Date.now() - lastFetchedAt) > maxAgeMs;
};

export {
    isOfflineError,
    isCacheStale,
    DEFAULT_MAX_AGE_MS,
};
