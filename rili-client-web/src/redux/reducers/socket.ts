import * as Immutable from 'seamless-immutable';
import { SocketServerActionTypes } from 'rili-public-library/utilities/constants';
import { IMessageList, ISocketState } from 'types/socket';

const initialState: ISocketState = Immutable.from({
    user: {
        userName: '',
        currentRoom: '',
    },
    rooms: [],
    messages: Immutable({}),
});

const socket = (state: ISocketState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState;
    }

    let prevMessageList: any = [];

    if (action.data && action.data.message) {
        prevMessageList = (state.messages[action.data.roomId] && state.messages[action.data.roomId].asMutable()) || [];
        prevMessageList.push(action.data.message);
    }
    const updatedMessageList: IMessageList = Immutable(prevMessageList);

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
        case SocketServerActionTypes.LEFT_ROOM:
            return state.setIn(['messages', action.data.roomId], updatedMessageList);
        case SocketServerActionTypes.OTHER_JOINED_ROOM:
        case SocketServerActionTypes.SEND_MESSAGE:
            return state.setIn(['messages', action.data.roomId], updatedMessageList);
        case SocketServerActionTypes.SESSION_MESSAGE:
            const actionData = action.data;
            actionData.data = JSON.parse(actionData.data);
            return state.setIn(['user', 'session'], actionData);
        default:
            return state;
    }
};

export default socket;