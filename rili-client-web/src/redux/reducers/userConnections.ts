import { SocketServerActionTypes } from 'rili-public-library/utilities/constants.js';
import * as Immutable from 'seamless-immutable';
import { IUserConnectionsState, UserConnectionActionTypes } from 'types/userConnections';

const initialState: IUserConnectionsState = Immutable.from({
    activeConnections: Immutable.from([]),
    connections: Immutable.from([]),
});

const userConnections = (state: IUserConnectionsState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    const activeConnections = [...state.activeConnections]; // eslint-disable-line no-case-declarations
    let uniqueConnections = [...state.connections]; // eslint-disable-line no-case-declarations

    switch (action.type) {
        case UserConnectionActionTypes.GET_USER_CONNECTIONS:
            // TODO: RFRONT-31 - Rethink/optimize/cleanup this
            const newConnections = (action.data || []).filter((connection) => { // eslint-disable-line no-case-declarations
                const existingIndex = uniqueConnections.findIndex((c) => c.id === connection.id);
                if (existingIndex > -1) {
                    uniqueConnections[existingIndex] = connection;
                    return false;
                }

                return true;
            });
            uniqueConnections = uniqueConnections.concat(newConnections);
            return state.setIn(['connections'], uniqueConnections);
        case SocketServerActionTypes.USER_CONNECTION_CREATED:
            return state.setIn(['connections'], [...uniqueConnections, action.data]);
        case SocketServerActionTypes.USER_CONNECTION_UPDATED:
            return state.setIn(['connections'], [...uniqueConnections, action.data]);
        case SocketServerActionTypes.ACTIVE_CONNECTIONS_LOADED:
            return state.setIn(['activeConnections'], action.data.activeUsers);
        case SocketServerActionTypes.ACTIVE_CONNECTION_DISCONNECTED:
        case SocketServerActionTypes.ACTIVE_CONNECTION_LOGGED_OUT:
            const leftUserIndex = activeConnections.findIndex((con) => con.id === action.data.id); // eslint-disable-line no-case-declarations
            if (leftUserIndex > -1) {
                activeConnections.splice(leftUserIndex, 1);
            }
            return state.setIn(['activeConnections'], activeConnections);
        case SocketServerActionTypes.ACTIVE_CONNECTION_LOGGED_IN:
        case SocketServerActionTypes.ACTIVE_CONNECTION_REFRESHED:
            const newUser = activeConnections.find((con) => con.id === action.data.id); // eslint-disable-line no-case-declarations
            if (!newUser) {
                activeConnections.unshift(action.data);
            }
            return state.setIn(['activeConnections'], activeConnections);
        case SocketServerActionTypes.SESSION_CLOSED:
            return state.setIn(['connections'], Immutable.from([]))
                .setIn(['activeConnections'], Immutable.from([]));
        default:
            return state;
    }
};

export default userConnections;
