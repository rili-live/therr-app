import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { NetworkActionTypes } from 'therr-react/types/redux/network';

let unsubscribe: (() => void) | null = null;

const startNetworkListener = (dispatch: any) => {
    if (unsubscribe) return; // Already listening

    unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
        dispatch({
            type: NetworkActionTypes.SET_NETWORK_STATUS,
            data: {
                isConnected: !!state.isConnected,
            },
        });
    });
};

const stopNetworkListener = () => {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
};

const checkIsConnected = async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
};

export {
    startNetworkListener,
    stopNetworkListener,
    checkIsConnected,
};
