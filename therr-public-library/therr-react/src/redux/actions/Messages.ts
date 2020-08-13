import { MessageActionTypes } from '../../types/redux/messages';
import MessagesService from '../../services/MessagesService';

const Messages = {
    search: (query: any) => (dispatch: any) => MessagesService.search(query).then((response: any) => {
        dispatch({
            type: MessageActionTypes.GET_MESSAGES,
            data: response.data.results,
        });
    }),
};

export default Messages;
