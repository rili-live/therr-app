import * as Immutable from 'seamless-immutable';

export interface IUserConnection {
    id: string;
    phoneNumber: string;
    userName: string;
}

export interface IUserConnectionsState extends Immutable.ImmutableObject<any> {
    activeConnections: any;
    connections: any;
}

export enum UserConnectionActionTypes {
    GET_USER_CONNECTIONS = 'GET_USER_CONNECTIONS',
}
