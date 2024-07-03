import { ForumActionTypes } from '../../types/redux/forums';
import ForumsService, { ICreateForumBody, ISearchForumsArgs } from '../../services/ForumsService';

const Forums = {
    createForum: (data: ICreateForumBody) => (dispatch: any) => ForumsService.createForum(data).then((response) => {
        dispatch({
            type: ForumActionTypes.CREATE_FORUM,
            data: response && response.data,
        });

        return response?.data;
    }),
    updateForum: (id: string, data: ICreateForumBody) => (dispatch: any) => ForumsService.updateForum(id, data).then((response) => {
        const resultData = {
            ...data,
            id: response?.data?.id,
            ...response?.data,
        }; // server doesn't return changes, so use request data
        dispatch({
            type: ForumActionTypes.UPDATE_FORUM,
            data: resultData,
        });

        return resultData;
    }),
    searchCategories: (query: any) => (dispatch: any) => ForumsService.searchCategories(query)
        .then((response: any) => {
            dispatch({
                type: ForumActionTypes.SEARCH_FORUM_CATEGORIES,
                data: response.data,
            });
        }),
    searchForums: (query: any, args: ISearchForumsArgs = {}) => (dispatch: any) => ForumsService.searchForums(query, args)
        .then((response: any) => {
            dispatch({
                type: ForumActionTypes.SEARCH_FORUMS,
                data: response.data,
            });
        }),
};

export default Forums;
