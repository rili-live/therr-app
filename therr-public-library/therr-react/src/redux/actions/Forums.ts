import { ForumActionTypes } from '../../types/redux/forums';
import ForumsService, { ICreateForumBody, ISearchForumsArgs } from '../../services/ForumsService';

const Forums = {
    createForum: (data: ICreateForumBody) => (dispatch: any) => ForumsService.createForum(data).then((response) => {
        dispatch({
            type: ForumActionTypes.CREATE_FORUM,
            data: response && response.data,
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
