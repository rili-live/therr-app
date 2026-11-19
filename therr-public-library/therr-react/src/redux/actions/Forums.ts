import { ForumActionTypes } from '../../types/redux/forums';
import ForumsService, { ICreateForumBody, IReportForumBody, ISearchForumsArgs } from '../../services/ForumsService';

const Forums = {
    getForumDetails: (forumId: string) => (dispatch: any) => ForumsService.getForum(forumId).then((response: any) => {
        if (response?.isOfflineFallback) return undefined;
        dispatch({
            type: ForumActionTypes.GET_FORUM_DETAILS,
            data: { forumId, forum: response?.data },
        });

        return response?.data;
    }),
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
    archiveForum: (id: string) => (dispatch: any) => ForumsService.archiveForum(id).then((response) => {
        dispatch({
            type: ForumActionTypes.DELETE_FORUM,
            data: {
                id,
            },
        });

        return {
            id,
        };
    }),
    searchCategories: (query: any) => (dispatch: any) => ForumsService.searchCategories(query)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ForumActionTypes.SEARCH_FORUM_CATEGORIES,
                data: response.data,
            });
        }),
    searchForums: (query: any, args: ISearchForumsArgs = {}) => (dispatch: any) => ForumsService.searchForums(query, args)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ForumActionTypes.SEARCH_FORUMS,
                data: response.data,
            });
        }),
    // Clears the group's unread badge right away; the request moves the server-side watermark.
    // A failed request is swallowed: the badge comes back on the next list refresh, which is the
    // right outcome when the server did not record the read.
    markForumRead: (forumId: string) => (dispatch: any) => {
        dispatch({
            type: ForumActionTypes.MARK_FORUM_READ,
            data: { forumId },
        });

        return ForumsService.markForumRead(forumId).catch(() => undefined);
    },
    reportForum: (forumId: string, data: IReportForumBody = {}) => (dispatch: any) => ForumsService.reportForum(forumId, data)
        .then((response: any) => {
            dispatch({
                type: ForumActionTypes.REPORT_FORUM,
                data: { forumId },
            });

            return response?.data;
        }),
    searchMyForums: (query: any, args: ISearchForumsArgs = {}) => (dispatch: any) => ForumsService.searchForums(query, args)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ForumActionTypes.SEARCH_MY_FORUMS,
                data: response.data,
            });
        }),
};

export default Forums;
