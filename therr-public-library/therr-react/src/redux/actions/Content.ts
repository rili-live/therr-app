import { ContentActionTypes } from '../../types/redux/content';
import ReactionsService, { ISearchActiveMomentsParams } from '../../services/ReactionsService';

const Content = {
    insertActiveMoments: (newActiveMoments: any) => (dispatch: any) => {
        dispatch({
            type: ContentActionTypes.INSERT_ACTIVE_MOMENTS,
            data: newActiveMoments,
        });
    },
    searchActiveMoments: (options: ISearchActiveMomentsParams) => (dispatch: any) => ReactionsService.searchActiveMoments(options)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_MOMENTS,
                data: response?.data,
            });
        }),
    updateActiveMoments: () => (dispatch: any) => ReactionsService.searchActiveMoments({
        offset: 0,
        withMedia: true,
        withUser: true,
    })
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_MOMENTS,
                data: response?.data,
            });
        }),
    searchBookmarkedMoments: (options: ISearchActiveMomentsParams) => (dispatch: any) => ReactionsService.searchBookmarkedMoments(options)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.SEARCH_BOOKMARKED_MOMENTS,
                data: response?.data,
            });
        }),
};

export default Content;
