import { ContentActionTypes } from '../../types/redux/content';
import ReactionsService, { ISearchActiveMomentsParams, ICreateOrUpdateMomentReactionBody } from '../../services/ReactionsService';

const Content = {
    insertActiveMoments: (newActiveMoments: any) => (dispatch: any) => {
        dispatch({
            type: ContentActionTypes.INSERT_ACTIVE_MOMENTS,
            data: newActiveMoments,
        });
    },
    searchActiveMoments: (options: ISearchActiveMomentsParams, limit = 21) => (dispatch: any) => ReactionsService
        .searchActiveMoments(options, limit)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_MOMENTS,
                data: response?.data,
            });
        }),
    updateActiveMoments: (options: ISearchActiveMomentsParams, limit = 21) => (dispatch: any) => ReactionsService
        .searchActiveMoments(options, limit)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_MOMENTS,
                data: response?.data,
            });
        }),
    createOrUpdateMomentReaction: (reactionId: number, params: ICreateOrUpdateMomentReactionBody) => (dispatch: any) => ReactionsService
        .createOrUpdateMomentReaction(reactionId, params)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_MOMENT_REACTION,
                data: response?.data,
            });
        }),
    searchBookmarkedMoments: (options: ISearchActiveMomentsParams) => (dispatch: any) => ReactionsService
        .searchBookmarkedMoments(options, 100)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.SEARCH_BOOKMARKED_MOMENTS,
                data: response?.data,
            });
        }),
};

export default Content;
