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

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    isListening = true;

    // Set initial state
    dispatch({
        type: NetworkActionTypes.SET_NETWORK_STATUS,
        data: { isConnected: navigator.onLine },
    });
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
