import { MessageActionTypes } from '../../types/redux/messages';
import MessagesService from '../../services/MessagesService';

const Messages = {
    searchDMs: (query: any, contextUserDetails) => (dispatch: any) => MessagesService.searchDMs(query).then((response: any) => {
        const data = { // TODO: Consider doing this mapping on the server side
            messages: response.data.results.map((directMessage) => ({
                key: directMessage.id,
                fromUserName: directMessage.fromUserId === contextUserDetails.id
                    ? contextUserDetails.userName
                    : 'You',
                text: directMessage.message,
                time: `${directMessage.createdAt}`, // TODO: Format date with local timezone in mind
            })),
            contextUserId: query.query,
            isLastPage: response.data.results.length < query.itemsPerPage,
        };

        dispatch({
            type: query.pageNumber > 1 ? MessageActionTypes.GET_MORE_DIRECT_MESSAGES : MessageActionTypes.GET_DIRECT_MESSAGES,
            data,
        });
    }),
    searchForumMessages: (query: any) => (dispatch: any) => MessagesService.searchForumMessages(query)
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
