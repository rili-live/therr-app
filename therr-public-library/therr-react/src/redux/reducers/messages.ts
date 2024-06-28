import Immutable from 'seamless-immutable';
import { SocketClientActionTypes, SocketServerActionTypes } from 'therr-js-utilities/constants';
import { IForumMsgList, IMessagesState, MessageActionTypes } from '../../types/redux/messages';

const initialState: IMessagesState = Immutable.from({
    forums: Immutable.from([]),
    dms: {},
    myDMs: {},
    forumMsgs: {},
});

const messages = (state: IMessagesState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    let prevMessageList: any = [];
    let prevDMsList: any = [];
    let initialDMsList: any = [];

    if (action.data?.roomId && action.data?.message) {
        prevMessageList = state.forumMsgs[action.data.roomId]?.asMutable() || [];
        prevMessageList.unshift(action.data.message);
    }
    const updatedMessageList: IForumMsgList = Immutable(prevMessageList);

    if (action.data?.contextUserId) {
        prevDMsList = (state.dms[action.data.contextUserId] // eslint-disable-line no-case-declarations
            && state.dms[action.data.contextUserId].asMutable()) || [];
        initialDMsList = action.data.messages || [];
    }

    switch (action.type) {
        // FORUMS
        case SocketServerActionTypes.JOINED_ROOM:
            return state
                .setIn(['forumMsgs', action.data.roomId], updatedMessageList);
        case SocketServerActionTypes.LEFT_ROOM:
            return state.setIn(['forumMsgs', action.data.roomId], updatedMessageList);
        case SocketServerActionTypes.OTHER_JOINED_ROOM:
        case SocketServerActionTypes.SEND_MESSAGE:
            return state.setIn(['forumMsgs', action.data.roomId], updatedMessageList);
        case MessageActionTypes.GET_FORUM_MESSAGES:
            return state.setIn(['forumMsgs', action.data.roomId], action.data.messages || []);

        // DMS
        case MessageActionTypes.GET_DIRECT_MESSAGES:
            if (action.data.isLastPage && initialDMsList?.length) {
                initialDMsList[initialDMsList.length - 1].isFirstMessage = true;
            }
            return state.setIn(['dms', action.data.contextUserId], initialDMsList);
        case MessageActionTypes.GET_MORE_DIRECT_MESSAGES:
            prevDMsList.push(...(action.data.messages || []));
            if (action.data.isLastPage) {
                prevDMsList[prevDMsList.length - 1].isFirstMessage = true;
            }
            return state.setIn(['dms', action.data.contextUserId], prevDMsList);
        case MessageActionTypes.GET_MY_DIRECT_MESSAGES:
            return state.setIn(['myDMs'], action.data.results)
                .setIn(['myDMsPagination'], { ...action.data.pagination });
        case MessageActionTypes.GET_MORE_OF_MY_DIRECT_MESSAGES:
            return state.setIn(['myDMs'], [...state.myDMs, ...action.data.results])
                .setIn(['myDMsPagination'], { ...action.data.pagination });
        case SocketServerActionTypes.SEND_DIRECT_MESSAGE:
            prevDMsList.unshift(action.data.message);
            return state.setIn(['dms', action.data.contextUserId], prevDMsList);
        case SocketClientActionTypes.LOGOUT:
            return state.setIn(['forums'], Immutable.from([]))
                .setIn(['dms'], Immutable.from([]))
                .setIn(['forumMsgs'], Immutable.from([]));
        default:
            return state;
    }
};

export default messages;
