import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes, SocketServerActionTypes } from 'rili-js-utilities/constants';
import { IUserState } from '../../types/redux/user';

const initialState: IUserState = Immutable.from({
    details: null,
    socketDetails: {},
    isAuthenticated: false,
});

const getUserReducer = (socketIO) => (state: IUserState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    const actionData = { ...action.data };

    switch (action.type) {
        case SocketServerActionTypes.JOINED_ROOM:
            return state
                .setIn(['socketDetails', 'currentRoom'], action.data.roomId);
        // case SocketServerActionTypes.USER_LOGIN_SUCCESS:
        //     return state.setIn(['socketDetails', 'userName'], action.data.userName);
        // case SocketServerActionTypes.USER_LOGOUT_SUCCESS:
        //     return state.setIn(['socketDetails', 'userName'], null);
        case SocketClientActionTypes.LOGIN:
            return state.setIn(['isAuthenticated'], true)
                .setIn(['details'], action.data);
        case SocketClientActionTypes.LOGOUT:
            return state.setIn(['isAuthenticated'], false)
                .setIn(['details'], null);
        case SocketServerActionTypes.SESSION_CREATED:
        case SocketServerActionTypes.SESSION_UPDATED:
            return state.setIn(['socketDetails', 'session'], (actionData && actionData.data) || {});
        case SocketServerActionTypes.SESSION_CLOSED:
            socketIO.disconnect();
            return state.setIn(['socketDetails', 'session'], {});
        default:
            return state;
    }
};

export default getUserReducer;
