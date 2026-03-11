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
    searchMyDMs: (query: any, userDetails) => (dispatch: any) => MessagesService.searchMyDMs(query).then((response: any) => {
        dispatch({
            type: query.pageNumber > 1 ? MessageActionTypes.GET_MORE_OF_MY_DIRECT_MESSAGES : MessageActionTypes.GET_MY_DIRECT_MESSAGES,
            data: response?.data,
        });

        return response?.data;
    }),
    markDmsRead: () => (dispatch: any) => {
        dispatch({ type: MessageActionTypes.MARK_DMS_READ });
    },
    searchForumMessages: (forumId: string, userId: string, query: any) => (dispatch: any) => MessagesService
        .searchForumMessages(forumId, query)
        .then((response: any) => {
            const messages = response.data.results.map((forumMessage) => ({
                ...forumMessage,
                key: forumMessage.id,
                fromUserImgSrc: `https://robohash.org/${forumMessage.fromUserId}`,
                text: forumMessage.message,
                time: `${forumMessage.createdAt}`, // TODO: Format date with locale timezone in mind
            }));
            dispatch({
                type: query.pageNumber > 1 ? MessageActionTypes.GET_MORE_FORUM_MESSAGES : MessageActionTypes.GET_FORUM_MESSAGES,
                data: {
                    roomId: forumId,
                    messages,
                    isLastPage: response.data.results.length < query.itemsPerPage,
                },
            });
        }),
};

export default Messages;
