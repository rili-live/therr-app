import { produce } from 'immer';
import { SocketClientActionTypes, SocketServerActionTypes } from 'therr-js-utilities/constants';
import { IMessagesState, MessageActionTypes } from '../../types/redux/messages';

const initialState: IMessagesState = {
    forums: [],
    dms: {},
    myDMs: {},
    forumMsgs: {},
    hasUnreadDms: false,
};

const messages = produce((draft: IMessagesState, action: any) => {
    switch (action.type) {
        // FORUMS
        case SocketServerActionTypes.JOINED_ROOM:
        case SocketServerActionTypes.LEFT_ROOM:
        case SocketServerActionTypes.OTHER_JOINED_ROOM:
        case SocketServerActionTypes.SEND_MESSAGE:
            if (action.data?.roomId) {
                if (!draft.forumMsgs[action.data.roomId]) {
                    draft.forumMsgs[action.data.roomId] = [];
                }
                if (action.data?.message) {
                    (draft.forumMsgs[action.data.roomId] as any[]).unshift(action.data.message);
                }
            }
            break;
        case MessageActionTypes.GET_FORUM_MESSAGES: {
            const initialMsgsList = action.data.messages || [];
            if (action.data.isLastPage && initialMsgsList.length) {
                initialMsgsList[initialMsgsList.length - 1].isFirstMessage = true;
            }
            draft.forumMsgs[action.data.roomId] = initialMsgsList;
            break;
        }
        case MessageActionTypes.GET_MORE_FORUM_MESSAGES: {
            if (!draft.forumMsgs[action.data.roomId]) {
                draft.forumMsgs[action.data.roomId] = [] as any;
            }
            const prevMsgs = draft.forumMsgs[action.data.roomId] as any[];
            prevMsgs.push(...(action.data.messages || []));
            if (action.data.isLastPage && prevMsgs.length) {
                prevMsgs[prevMsgs.length - 1].isFirstMessage = true;
            }
            break;
        }

        // DMS
        case MessageActionTypes.GET_DIRECT_MESSAGES: {
            const initialDMsList = action.data.messages || [];
            if (action.data.isLastPage && initialDMsList.length) {
                initialDMsList[initialDMsList.length - 1].isFirstMessage = true;
            }
            draft.dms[action.data.contextUserId] = initialDMsList;
            break;
        }
        case MessageActionTypes.GET_MORE_DIRECT_MESSAGES: {
            if (!draft.dms[action.data.contextUserId]) {
                draft.dms[action.data.contextUserId] = [] as any;
            }
            const prevDMs = draft.dms[action.data.contextUserId] as any[];
            prevDMs.push(...(action.data.messages || []));
            if (action.data.isLastPage && prevDMs.length) {
                prevDMs[prevDMs.length - 1].isFirstMessage = true;
            }
            break;
        }
        case MessageActionTypes.GET_MY_DIRECT_MESSAGES:
            draft.myDMs = action.data.results;
            draft.myDMsPagination = { ...action.data.pagination };
            break;
        case MessageActionTypes.GET_MORE_OF_MY_DIRECT_MESSAGES:
            draft.myDMs = [...draft.myDMs, ...action.data.results];
            draft.myDMsPagination = { ...action.data.pagination };
            break;
        case SocketServerActionTypes.SEND_DIRECT_MESSAGE: {
            if (!draft.dms[action.data.contextUserId]) {
                draft.dms[action.data.contextUserId] = [] as any;
            }
            (draft.dms[action.data.contextUserId] as any[]).unshift(action.data.message);
            draft.hasUnreadDms = true;
            break;
        }
        case MessageActionTypes.MARK_DMS_READ:
            draft.hasUnreadDms = false;
            break;
        case SocketClientActionTypes.LOGOUT:
            draft.forums = [];
            draft.dms = {};
            draft.forumMsgs = {};
            break;
        default:
            break;
    }
}, initialState);

export default messages;
