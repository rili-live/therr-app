import { produce } from 'immer';
import { SocketClientActionTypes, SocketServerActionTypes } from 'therr-js-utilities/constants';
import { IUserConnectionsState, UserConnectionActionTypes } from '../../types/redux/userConnections';

const initialState: IUserConnectionsState = {
    activeConnections: [],
    connections: [],
};

const userConnections = produce((draft: IUserConnectionsState, action: any) => {
    switch (action.type) {
        case UserConnectionActionTypes.GET_USER_CONNECTIONS: {
            const newConnections = (action.data || []).filter((connection) => {
                const existingIndex = draft.connections.findIndex((c) => c.id === connection.id);
                if (existingIndex > -1) {
                    draft.connections[existingIndex] = connection;
                    return false;
                }
                return true;
            });
            draft.connections.push(...newConnections);
            break;
        }
        case SocketServerActionTypes.USER_CONNECTION_CREATED:
            draft.connections.push(action.data);
            break;
        case SocketServerActionTypes.USER_CONNECTION_UPDATED:
            draft.connections.push(action.data);
            break;
        case SocketServerActionTypes.ACTIVE_CONNECTIONS_ADDED:
            draft.activeConnections.unshift(action.data);
            break;
        case SocketServerActionTypes.ACTIVE_CONNECTIONS_LOADED:
            draft.activeConnections = action.data.activeUsers;
            break;
        case SocketServerActionTypes.ACTIVE_CONNECTION_DISCONNECTED: {
            const disIdx = draft.activeConnections.findIndex((con) => action.data && con.id === action.data.id);
            if (disIdx > -1) {
                draft.activeConnections[disIdx] = { ...draft.activeConnections[disIdx], status: 'away' };
            }
            break;
        }
        case SocketServerActionTypes.ACTIVE_CONNECTION_LOGGED_OUT: {
            const logoutIdx = draft.activeConnections.findIndex((con) => action.data && con.id === action.data.id);
            if (logoutIdx > -1) {
                draft.activeConnections.splice(logoutIdx, 1);
            }
            break;
        }
        case SocketServerActionTypes.ACTIVE_CONNECTION_LOGGED_IN:
        case SocketServerActionTypes.ACTIVE_CONNECTION_REFRESHED: {
            const existingUserIndex = draft.activeConnections.findIndex((con) => con.id === action.data.id);
            if (existingUserIndex > -1) {
                draft.activeConnections.splice(existingUserIndex, 1, { ...action.data, status: 'active' });
            } else {
                draft.activeConnections.unshift(action.data);
            }
            break;
        }
        case SocketServerActionTypes.SESSION_CLOSED:
        case SocketClientActionTypes.LOGOUT:
            draft.connections = [];
            draft.activeConnections = [];
            break;
        default:
            break;
    }
}, initialState);

export default userConnections;
