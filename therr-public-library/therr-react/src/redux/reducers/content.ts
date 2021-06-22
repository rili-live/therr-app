import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IContentState, ContentActionTypes } from '../../types/redux/content';
import { MapActionTypes } from '../../types';

const initialState: IContentState = Immutable.from({
    activeMoments: Immutable.from([]),
    media: Immutable.from({}),
});

const content = (state: IContentState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    // TODO: consider storing as Set to prevent duplicates
    switch (action.type) {
        case ContentActionTypes.INSERT_ACTIVE_MOMENTS:
            // Add latest moments to start
            return state.setIn(['activeMoments'], [...action.data, ...state.activeMoments]);
        case ContentActionTypes.SEARCH_ACTIVE_MOMENTS:
            // Add next offset of moments to end
            return state.setIn(['activeMoments'], [...state.activeMoments, ...action.data.moments])
                .setIn(['media'], { ...state.media, ...action.data.media });
        case ContentActionTypes.UPDATE_ACTIVE_MOMENTS:
            // Reset moments from scratch
            return state.setIn(['activeMoments'], action.data.moments)
                .setIn(['media'], action.data.media);
        case MapActionTypes.GET_MOMENT_DETAILS:
            // Reset moments from scratch
            return state.setIn(['media'], { ...state.media, ...action.data.media });
        case SocketClientActionTypes.LOGOUT:
            return state.setIn(['activeMoments'], Immutable.from([]));
        default:
            return state;
    }
};

export default content;
