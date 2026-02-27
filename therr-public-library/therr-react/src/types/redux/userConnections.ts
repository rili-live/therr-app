export interface IUserConnection {
  id: string;
  phoneNumber: string;
  userName: string;
}

export interface IUserConnectionsState {
  activeConnections: any;
  connections: any;
}

export enum UserConnectionActionTypes {
  GET_USER_CONNECTIONS = 'GET_USER_CONNECTIONS',
}
