import { produce } from 'immer';
import { SocketClientActionTypes, SocketServerActionTypes } from 'therr-js-utilities/constants';
import { ForumActionTypes, IForumsState } from '../../types/redux/forums';

const initialState: IForumsState = {
    activeForums: [],
    forumCategories: [],
    forumDetails: {},
    myForumsSearchResults: [],
    myForumsPagination: [],
    searchResults: [],
    pagination: {},
};

const forums = produce((draft: IForumsState, action: any) => {
    switch (action.type) {
        case ForumActionTypes.GET_FORUM_DETAILS:
            draft.forumDetails[action.data.forumId] = action.data.forum;
            break;
        case ForumActionTypes.CREATE_FORUM:
            draft.searchResults.unshift(action.data?.forum || action.data);
            break;
        case ForumActionTypes.UPDATE_FORUM: {
            const updateIdx = draft.searchResults.findIndex((group) => group.id === action.data?.id);
            if (updateIdx > -1) {
                draft.searchResults[updateIdx] = {
                    ...draft.searchResults[updateIdx],
                    ...action.data,
                };
            }
            break;
        }
        case ForumActionTypes.DELETE_FORUM: {
            const deleteIdx = draft.searchResults.findIndex((group) => group.id === action.data?.id);
            if (deleteIdx > -1) {
                draft.searchResults.splice(deleteIdx, 1);
            }
            break;
        }
        case ForumActionTypes.SEARCH_FORUMS:
            draft.searchResults = action.data.results;
            draft.pagination = action.data.pagination;
            break;
        case ForumActionTypes.SEARCH_MY_FORUMS:
            draft.myForumsSearchResults = action.data.results;
            draft.myForumsPagination = action.data.pagination;
            break;
        case ForumActionTypes.SEARCH_FORUM_CATEGORIES:
            draft.forumCategories = action.data.results;
            break;
        case SocketServerActionTypes.SEND_ROOMS_LIST:
            draft.activeForums = action.data;
            break;
        case SocketClientActionTypes.LOGOUT:
            draft.myForumsSearchResults = [];
            draft.myForumsPagination = [];
            draft.searchResults = [];
            draft.pagination = [];
            break;
        default:
            break;
    }
}, initialState);

export default forums;
