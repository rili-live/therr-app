import Immutable from 'seamless-immutable';
import { SocketClientActionTypes, SocketServerActionTypes } from 'therr-js-utilities/constants';
import { ForumActionTypes, IForumsState } from '../../types/redux/forums';

const initialState: IForumsState = Immutable.from({
    activeForums: Immutable.from([]),
    forumCategories: Immutable.from([]),
    myForumsSearchResults: Immutable.from([]),
    myForumsPagination: Immutable.from([]),
    searchResults: Immutable.from([]),
    pagination: Immutable.from({}),
});

const messages = (state: IForumsState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    switch (action.type) {
        case ForumActionTypes.CREATE_FORUM:
            return state.setIn(['searchResults'], [
                (action.data?.forum || action.data), // TODO: Cleanup this backwards compatibility hack
                ...state.searchResults,
            ]);
        case ForumActionTypes.SEARCH_FORUMS:
            return state.setIn(['searchResults'], action.data.results)
                .setIn(['pagination'], action.data.pagination);
        case ForumActionTypes.SEARCH_FORUM_CATEGORIES:
            return state.setIn(['forumCategories'], action.data.results);
        case SocketServerActionTypes.SEND_ROOMS_LIST:
            // Any time this action is called, the data will be a full forum list from the server
            return state.setIn(['activeForums'], action.data);
        case SocketClientActionTypes.LOGOUT:
            return state.setIn(['myForumsSearchResults'], Immutable.from([]))
                .setIn(['myForumsPagination'], Immutable.from([]))
                .setIn(['searchResults'], Immutable.from([]))
                .setIn(['pagination'], Immutable.from([]));
        default:
            return state;
    }
};

export default messages;
