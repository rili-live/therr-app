import Immutable from 'seamless-immutable';
import { SocketServerActionTypes } from 'rili-public-library/utilities/constants.js';
import { IMessageList, ISocketState } from 'types/socket';

// TODO: RSERV-26 - Create separate auth, room, and messages actions/reducers
const initialState: ISocketState = Immutable.from({
    user: {
        userName: '',
        currentRoom: '',
        session: {},
    },
    rooms: Immutable.from([]),
    messages: {},
});

const socket = (state: ISocketState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    let prevMessageList: any = [];

    if (action.data && action.data.message) {
        prevMessageList = (state.messages[action.data.roomId] && state.messages[action.data.roomId].asMutable()) || [];
        prevMessageList.push(action.data.message);
    }
    const updatedMessageList: IMessageList = Immutable(prevMessageList);
    const actionData = action.data;

    switch (action.type) {
        case SocketServerActionTypes.SEND_ROOMS_LIST:
            // Any time this action is called, the data will be a full room list from the server
            return state.setIn(['rooms'], action.data);
        case SocketServerActionTypes.JOINED_ROOM:
            return state
                .setIn(['user', 'userName'], action.data.userName)
                .setIn(['user', 'currentRoom'], action.data.roomId)
                .setIn(['messages', action.data.roomId], updatedMessageList);
        case SocketServerActionTypes.USER_LOGIN_SUCCESS:
            return state.setIn(['user', 'userName'], action.data.userName);
        case SocketServerActionTypes.USER_LOGOUT_SUCCESS:
            return state.setIn(['user', 'userName'], null);
        case SocketServerActionTypes.LEFT_ROOM:
            return state.setIn(['messages', action.data.roomId], updatedMessageList);
        case SocketServerActionTypes.OTHER_JOINED_ROOM:
        case SocketServerActionTypes.SEND_MESSAGE:
            return state.setIn(['messages', action.data.roomId], updatedMessageList);
        case SocketServerActionTypes.SESSION_CREATED_MESSAGE:
            return state.setIn(['user', 'session'], (actionData && actionData.data) || {});
        case SocketServerActionTypes.SESSION_CLOSED_MESSAGE:
            return state.setIn(['user', 'session'], {});
        default:
            return state;
    }
};

export default socket;
