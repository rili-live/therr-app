export interface INetworkState {
    isConnected: boolean;
    lastOnlineAt: number | null;
}

export enum NetworkActionTypes {
    SET_NETWORK_STATUS = 'SET_NETWORK_STATUS',
}
