import * as Immutable from 'seamless-immutable';
import { Location, SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IMapState, MapActionTypes } from '../../types/redux/maps';
import { ContentActionTypes } from '../../types/redux/content';

const initialState: IMapState = Immutable.from({
    moments: Immutable.from({}),
    spaces: Immutable.from({}),
    searchPredictions: Immutable.from({}),
    radiusOfAwareness: (Location.MAX_RADIUS_OF_AWARENESS - Location.MIN_RADIUS_OF_AWARENESS) / 2,
    radiusOfInfluence: (Location.MAX_RADIUS_OF_INFLUENCE - Location.MIN_RADIUS_OF_INFLUENCE) / 2,
    recentEngagements: Immutable.from({}),

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

    // Slice to keep total from overflowing
    const slicedMoments = Object.entries(state.moments).slice(0, 300).reduce((acc, cur) => {
        const [key, value] = cur;
        acc[key] = value;

        return acc;
    }, {});
    const modifiedMoments = { ...slicedMoments };
    const slicedSpaces = Object.entries(state.spaces).slice(0, 300).reduce((acc, cur) => {
        const [key, value] = cur;
        acc[key] = value;

        return acc;
    }, {});
    const modifiedSpaces = { ...slicedSpaces };

    switch (action.type) {
        case MapActionTypes.GET_MOMENTS:
        case MapActionTypes.GET_MY_MOMENTS:
            // Convert array to object for faster lookup and de-duping
            return state.setIn(['moments'], action.data.results.filter((a) => a.longitude && a.latitude)
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: item,
                }), modifiedMoments));
        case ContentActionTypes.SEARCH_ACTIVE_MOMENTS_BY_IDS:
            // Convert array to object for faster lookup and de-duping
            return state.setIn(['moments'], action.data.moments.filter((a) => a.longitude && a.latitude)
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: item,
                }), modifiedMoments));
        case MapActionTypes.GET_MOMENT_DETAILS:
            if (action.data?.moment?.id) {
                if (!modifiedMoments[action.data.moment.id]) {
                    modifiedMoments[action.data.moment.id] = action.data.moment;
                } else {
                    modifiedMoments[action.data.moment.id] = {
                        ...modifiedMoments[action.data.moment.id],
                        ...action.data.moment,
                    };
                }
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
        case MapActionTypes.LIST_SPACES:
            return state.setIn(['spaces'], action.data.results
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: item,
                }), {}));
        case MapActionTypes.GET_SPACES:
        case MapActionTypes.GET_MY_SPACES:
            return state.setIn(['spaces'], action.data.results.filter((a) => a.longitude && a.latitude)
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: item,
                }), modifiedSpaces));
        case ContentActionTypes.SEARCH_ACTIVE_SPACES_BY_IDS:
            // Convert array to object for faster lookup and de-duping
            return state.setIn(['spaces'], action.data.spaces.filter((a) => a.longitude && a.latitude)
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: item,
                }), modifiedSpaces));
        case MapActionTypes.GET_SPACE_DETAILS:
            if (action.data.space?.id) {
                if (!modifiedSpaces[action.data.space.id]) {
                    modifiedSpaces[action.data.space.id] = action.data.space;
                } else {
                    modifiedSpaces[action.data.space.id] = {
                        ...modifiedSpaces[action.data.space.id],
                        ...action.data.space,
                    };
                }
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
        case MapActionTypes.UPDATE_RECENT_ENGAGEMENTS:
            return state.setIn(['recentEngagements'], {
                ...state.recentEngagements,
                [action.data.spaceId]: action.data,
            });
        // // // // // // // // // // // //
        case MapActionTypes.UPDATE_MAP_VIEW_COORDS:
            return state
                .setIn(['prevLongitude'], state.longitude)
                .setIn(['prevLatitude'], state.latitude)
                .setIn(['prevLongitudeDelta'], state.longitudeDelta)
                .setIn(['prevLatitudeDelta'], state.latitudeDelta)
                .setIn(['longitude'], action.data.longitude || state.longitude)
                .setIn(['latitude'], action.data.latitude || state.latitude)
                .setIn(['longitudeDelta'], action.data.longitudeDelta || state.longitudeDelta)
                .setIn(['latitudeDelta'], action.data.latitudeDelta || state.latitudeDelta);
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
