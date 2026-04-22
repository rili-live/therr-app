import { produce } from 'immer';
import { INetworkState, NetworkActionTypes } from '../../types/redux/network';

const initialState: INetworkState = {
    isConnected: true,
    lastOnlineAt: null,
};

const network = produce((draft: INetworkState, action: any) => {
    switch (action.type) {
        case NetworkActionTypes.SET_NETWORK_STATUS:
            if (action.data.isConnected && !draft.isConnected) {
                draft.lastOnlineAt = Date.now();
            }
            draft.isConnected = action.data.isConnected;
            break;
        default:
            break;
    }
}, initialState);

export default network;
