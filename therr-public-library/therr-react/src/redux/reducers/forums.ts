import Immutable from 'seamless-immutable';
import { SocketServerActionTypes } from 'therr-js-utilities/constants';
import { ForumActionTypes, IForumsState } from '../../types/redux/forums';

const initialState: IForumsState = Immutable.from({
    myForumsSearchResults: Immutable.from([]),
    myForumsPagination: Immutable.from([]),
    searchResults: Immutable.from([]),
    pagination: Immutable.from([]),
});

const messages = (state: IForumsState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    switch (action.type) {
        case ForumActionTypes.SEARCH_FORUMS:
            return state.setIn(['searchResults'], action.data.results)
                .setIn(['pagination'], action.data.pagination);
        case SocketServerActionTypes.SEND_ROOMS_LIST:
            // Any time this action is called, the data will be a full forum list from the server
            return state.setIn(['forums'], action.data);
        default:
            return state;
    }
};

export default messages;
