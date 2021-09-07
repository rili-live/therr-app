import { ContentActionTypes } from '../../types/redux/content';
import ReactionsService, { ISearchActiveMomentsParams } from '../../services/ReactionsService';

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
};

export default Content;
