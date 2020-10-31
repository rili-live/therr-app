import { MessageActionTypes } from '../../types/redux/messages';
import MessagesService from '../../services/MessagesService';

const Messages = {
    search: (query: any, contextUserDetails) => (dispatch: any) => MessagesService.search(query).then((response: any) => {
        dispatch({
            type: MessageActionTypes.GET_DIRECT_MESSAGES,
            data: { // TODO: Consider doing this mapping on the server side
                messages: response.data.results.map((directMessage, idx) => ({
                    key: idx,
                    text: directMessage.fromUserId === contextUserDetails.id
                        ? `${contextUserDetails.userName}: ${directMessage.message}`
                        : `You: ${directMessage.message}`,
                    time: `${directMessage.createdAt}`, // TODO: Format date with locale timezone in mind
                })),
                contextUserId: query.query,
            },
        });
    }),
};

export default Messages;
