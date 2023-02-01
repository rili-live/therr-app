import * as Immutable from 'seamless-immutable';
import { Location, SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IMapState, MapActionTypes } from '../../types/redux/maps';

const initialState: IMapState = Immutable.from({
    moments: Immutable.from({}),
    spaces: Immutable.from({}),
    searchPredictions: Immutable.from({}),
    radiusOfAwareness: (Location.MAX_RADIUS_OF_AWARENESS - Location.MIN_RADIUS_OF_AWARENESS) / 2,
    radiusOfInfluence: (Location.MAX_RADIUS_OF_INFLUENCE - Location.MIN_RADIUS_OF_INFLUENCE) / 2,

    // Filters
    filtersAuthor: Immutable.from([]),
    filtersCategory: Immutable.from([]),
    filtersVisibility: Immutable.from([]),
});

const map = (state: IMapState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    const modifiedMoments = { ...state.moments };
    const modifiedSpaces = { ...state.spaces };

    switch (action.type) {
        case MapActionTypes.GET_MOMENTS:
        case MapActionTypes.GET_MY_MOMENTS:
            // Convert array to object for faster lookup and de-duping
            return state.setIn(['moments'], action.data.results.reduce((acc, item) => ({
                ...acc,
                [item.id]: item,
            }), modifiedMoments));
        case MapActionTypes.GET_MOMENT_DETAILS:
            if (!modifiedMoments[action.data.moment.id]) {
                modifiedMoments[action.data.moment.id] = action.data.moment;
            } else {
                modifiedMoments[action.data.moment.id] = {
                    ...modifiedMoments[action.data.moment.id],
                    ...action.data.moment,
                };
            }
            return state.setIn(['moments'], modifiedMoments);
        case MapActionTypes.MOMENT_CREATED:
            modifiedMoments[action.data?.id] = action.data;
            return state.setIn(['moments'], modifiedMoments);
        case MapActionTypes.MOMENT_UPDATED:
            if (!modifiedMoments[action.data.id]) {
                modifiedMoments[action.data.id] = action.data;
            } else {
                modifiedMoments[action.data.id] = {
                    ...modifiedMoments[action.data.id],
                    ...action.data,
                };
            }
            return state.setIn(['moments'], modifiedMoments);
        case MapActionTypes.MOMENT_DELETED:
            delete modifiedMoments[action.data.id];
            return state.setIn(['moments'], modifiedMoments);
        // // // // // // // // // // // //
        case MapActionTypes.GET_SPACES:
        case MapActionTypes.GET_MY_SPACES:
            return state.setIn(['spaces'], action.data.results.reduce((acc, item) => ({
                ...acc,
                [item.id]: item,
            }), modifiedSpaces));
        case MapActionTypes.GET_SPACE_DETAILS:
            if (!modifiedSpaces[action.data.space.id]) {
                modifiedSpaces[action.data.space.id] = action.data.space;
            } else {
                modifiedSpaces[action.data.space.id] = {
                    ...modifiedSpaces[action.data.space.id],
                    ...action.data.space,
                };
            }
            return state.setIn(['spaces'], modifiedSpaces);
        case MapActionTypes.SPACE_CREATED:
            modifiedSpaces[action.data?.id] = action.data;
            return state.setIn(['spaces'], modifiedSpaces);
        case MapActionTypes.SPACE_UPDATED:
            if (!modifiedSpaces[action.data.space.id]) {
                modifiedSpaces[action.data.space.id] = action.data.space;
            } else {
                modifiedSpaces[action.data.space.id] = {
                    ...modifiedSpaces[action.data.space.id],
                    ...action.data.space,
                };
            }
            return state.setIn(['spaces'], modifiedSpaces);
        case MapActionTypes.SPACE_DELETED:
            delete modifiedSpaces[action.data.id];
            return state.setIn(['spaces'], modifiedSpaces);
        // // // // // // // // // // // //
        case MapActionTypes.UPDATE_COORDS:
            return state
                .setIn(['longitude'], action.data.longitude)
                .setIn(['latitude'], action.data.latitude)
                .setIn(['prevLongitude'], state.longitude)
                .setIn(['prevLatitude'], state.latitude);
        case MapActionTypes.UPDATE_USER_RADIUS:
            return state
                .setIn(['radiusOfAwareness'], action.data.radiusOfAwareness)
                .setIn(['radiusOfInfluence'], action.data.radiusOfInfluence);
        case MapActionTypes.USER_LOCATION_DETERMINED:
            return state.setIn(['hasUserLocationLoaded'], true);
        case MapActionTypes.AUTOCOMPLETE_UPDATE:
            return state.setIn(['searchPredictions', 'results'], action.data.predictions);
        case MapActionTypes.SET_DROPDOWN_VISIBILITY:
            return state.setIn(['searchPredictions', 'isSearchDropdownVisible'], action.data.isSearchDropdownVisible);
        case SocketClientActionTypes.LOGOUT:
            return state
                .setIn(['searchPredictions', 'results'], [])
                .setIn(['searchPredictions', 'isSearchDropdownVisible'], false)
                .setIn(['hasUserLocationLoaded'], false)
                .setIn(['moments'], Immutable.from({}));
        // // // // // // // // // // // //
        case MapActionTypes.SET_MAP_FILTERS:
            return state.setIn(['filtersAuthor'], action.data.filtersAuthor || state.filtersAuthor)
                .setIn(['filtersCategory'], action.data.filtersCategory || state.filtersCategory)
                .setIn(['filtersVisibility'], action.data.filtersVisibility || state.filtersVisibility);
        default:
            return state;
    }
};

export default map;
