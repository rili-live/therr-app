import Immutable from 'seamless-immutable';
import { SocketClientActionTypes, SocketServerActionTypes } from 'therr-js-utilities/constants';
import { IForumMsgList, IMessagesState, MessageActionTypes } from '../../types/redux/messages';

const initialState: IMessagesState = Immutable.from({
    forums: Immutable.from([]),
    dms: {},
    forumMsgs: {},
});

const messages = (state: IMessagesState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    let prevMessageList: any = [];

    if (action.data && action.data.message) {
        prevMessageList = (state.forumMsgs[action.data.roomId] && state.forumMsgs[action.data.roomId].asMutable()) || [];
        prevMessageList.push(action.data.message);
    }
    const updatedMessageList: IForumMsgList = Immutable(prevMessageList);

    switch (action.type) {
        case MessageActionTypes.CREATE_FORUM:
            return state.setIn(['myForums'], [...state.myForums, action.data]);
        case SocketServerActionTypes.SEND_ROOMS_LIST:
            // Any time this action is called, the data will be a full forum list from the server
            return state.setIn(['forums'], action.data);
        case SocketServerActionTypes.JOINED_ROOM:
            return state
                .setIn(['forumMsgs', action.data.roomId], updatedMessageList);
        case SocketServerActionTypes.LEFT_ROOM:
            return state.setIn(['forumMsgs', action.data.roomId], updatedMessageList);
        case SocketServerActionTypes.OTHER_JOINED_ROOM:
        case SocketServerActionTypes.SEND_MESSAGE:
            return state.setIn(['forumMsgs', action.data.roomId], updatedMessageList);
        case MessageActionTypes.GET_DIRECT_MESSAGES:
            return state.setIn(['dms', action.data.contextUserId], action.data.messages || []);
        case MessageActionTypes.GET_FORUM_MESSAGES:
            return state.setIn(['forumMessages', action.data.id], action.data.messages || []);
        case SocketServerActionTypes.SEND_DIRECT_MESSAGE:
            const directMessages = (state.dms[action.data.contextUserId] // eslint-disable-line no-case-declarations
                && state.dms[action.data.contextUserId].asMutable()) || [];
            directMessages.push(action.data.message);
            return state.setIn(['dms', action.data.contextUserId], directMessages);
        case SocketClientActionTypes.LOGOUT:
            return state.setIn(['dms'], Immutable.from([]))
                .setIn(['forumMsgs'], Immutable.from([]));
        default:
            return state;
    }
};

export default messages;
