import { MessageActionTypes } from '../../types/redux/messages';
import MessagesService, { ICreateForumBody } from '../../services/MessagesService';

const Messages = {
    createForum: (data: ICreateForumBody) => (dispatch: any) => MessagesService.createForum(data).then((response) => {
        dispatch({
            type: MessageActionTypes.CREATE_FORUM,
            data: response && response.data,
        });
    }),
    searchDMs: (query: any, contextUserDetails) => (dispatch: any) => MessagesService.searchDMs(query).then((response: any) => {
        dispatch({
            type: MessageActionTypes.GET_DIRECT_MESSAGES,
            data: { // TODO: Consider doing this mapping on the server side
                messages: response.data.results.map((directMessage, idx) => ({
                    key: idx,
                    fromUserName: directMessage.fromUserId === contextUserDetails.id
                        ? contextUserDetails.userName
                        : 'You',
                    text: directMessage.message,
                    time: `${directMessage.createdAt}`, // TODO: Format date with locale timezone in mind
                })),
                contextUserId: query.query,
            },
        });
    }),
    searchForumMessages: (query: any, contextUserDetails) => (dispatch: any) => MessagesService.searchForumMessages(query)
        .then((response: any) => {
            dispatch({
                type: MessageActionTypes.GET_FORUM_MESSAGES,
                data: {
                    messages: response.data.results.map((forumMessage, idx) => ({
                        key: idx,
                        fromUserName: forumMessage.fromUserName,
                        text: forumMessage.message,
                        time: `${forumMessage.createdAt}`, // TODO: Format date with locale timezone in mind
                    })),
                    contextUserId: query.query,
                },
            });
        }),
};

export default Messages;
