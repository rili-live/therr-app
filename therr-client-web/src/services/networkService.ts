import { NetworkActionTypes } from 'therr-react/types/redux';

let isListening = false;
let handleOnline: (() => void) | null = null;
let handleOffline: (() => void) | null = null;

const startNetworkListener = (dispatch: any) => {
    if (isListening || typeof window === 'undefined') return;

    handleOnline = () => {
        dispatch({
            type: NetworkActionTypes.SET_NETWORK_STATUS,
            data: { isConnected: true },
        });
    };

    handleOffline = () => {
        dispatch({
            type: NetworkActionTypes.SET_NETWORK_STATUS,
            data: { isConnected: false },
        });
    };

    // Intentionally not seeding from navigator.onLine: it has well-known
    // false-negative cases (Linux without a configured NetworkManager,
    // virtualized adapters, certain Chromium builds) that made the offline
    // badge appear on a healthy connection. The reducer defaults to
    // isConnected: true, and the online/offline events fire reliably on
    // real transitions.
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    isListening = true;
};

const stopNetworkListener = () => {
    if (!isListening || typeof window === 'undefined') return;

    if (handleOnline) window.removeEventListener('online', handleOnline);
    if (handleOffline) window.removeEventListener('offline', handleOffline);
    handleOnline = null;
    handleOffline = null;
    isListening = false;
};

export {
    startNetworkListener,
    stopNetworkListener,
};
