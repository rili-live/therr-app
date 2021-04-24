import { ContentActionTypes } from '../../types/redux/content';
import ReactionsService from '../../services/ReactionsService';

const Content = {
    insertActiveMoments: (newActiveMoments: any) => (dispatch: any) => {
        dispatch({
            type: ContentActionTypes.INSERT_ACTIVE_MOMENTS,
            data: newActiveMoments,
        });
    },
    searchActiveMoments: (offset: number) => (dispatch: any) => ReactionsService.searchActiveMoments(offset)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_MOMENTS,
                data: response.data,
            });
        }),
    updateActiveMoments: () => (dispatch: any) => ReactionsService.searchActiveMoments(0)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_MOMENTS,
                data: response?.data?.moments,
            });
        }),
};

export default Content;
