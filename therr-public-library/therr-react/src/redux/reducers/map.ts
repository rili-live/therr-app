import * as Immutable from 'seamless-immutable';
import { Location, SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IMapState, MapActionTypes } from '../../types/redux/maps';

const initialState: IMapState = Immutable.from({
    moments: Immutable.from([]),
    myMoments: Immutable.from([]),
    spaces: Immutable.from([]),
    mySpaces: Immutable.from([]),
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

    const modifiedMoment = [...state.moments];
    let modifiedMyMoment = [...state.myMoments];
    const modifiedSpace = [...state.spaces];
    let modifiedMySpace = [...state.mySpaces];

    switch (action.type) {
        case MapActionTypes.GET_MOMENTS:
            return state.setIn(['moments'], action.data.results);
        case MapActionTypes.GET_MOMENT_DETAILS:
            modifiedMoment.some((moment, index) => { // eslint-disable-line no-case-declarations
                if (moment.id === action.data.moment?.id) {
                    modifiedMoment[index] = {
                        ...moment,
                        ...action.data.moment,
                    };
                    return true;
                }

                return false;
            });
            return state.setIn(['moments'], modifiedMoment);
        case MapActionTypes.GET_MY_MOMENTS:
            return state.setIn(['myMoments'], action.data.results);
        case MapActionTypes.MOMENT_CREATED:
            modifiedMyMoment.unshift(action.data);
            return state.setIn(['myMoments'], modifiedMyMoment);
        case MapActionTypes.MOMENT_UPDATED:
            modifiedMyMoment.some((moment, index) => {
                if (moment.id === action.data.id) {
                    modifiedMyMoment[index] = {
                        ...moment,
                        ...action.data,
                    };
                    return true;
                }

                return false;
            });
            return state.setIn(['myMoments'], modifiedMyMoment);
        case MapActionTypes.MOMENT_DELETED:
            modifiedMyMoment = state.myMoments.filter((moment) => { // eslint-disable-line no-case-declarations
                if (!action.data || !action.data.ids) {
                    return true;
                }
                return !action.data.ids.includes(moment.id);
            });
            return state.setIn(['myMoments'], modifiedMyMoment);
        // // // // // // // // // // // //
        case MapActionTypes.GET_SPACES:
            return state.setIn(['spaces'], action.data.results);
        case MapActionTypes.GET_SPACE_DETAILS:
            modifiedSpace.some((space, index) => { // eslint-disable-line no-case-declarations
                if (space.id === action.data.space?.id) {
                    modifiedSpace[index] = {
                        ...space,
                        ...action.data.space,
                    };
                    return true;
                }

                return false;
            });
            return state.setIn(['spaces'], modifiedSpace);
        case MapActionTypes.GET_MY_SPACES:
            return state.setIn(['mySpaces'], action.data.results);
        case MapActionTypes.SPACE_CREATED:
            modifiedMySpace.unshift(action.data);
            return state.setIn(['mySpaces'], modifiedMySpace);
        case MapActionTypes.SPACE_UPDATED:
            modifiedMySpace.some((space, index) => {
                if (space.id === action.data.id) {
                    modifiedMySpace[index] = {
                        ...space,
                        ...action.data,
                    };
                    return true;
                }

                return false;
            });
            return state.setIn(['mySpaces'], modifiedMySpace);
        case MapActionTypes.SPACE_DELETED:
            modifiedMySpace = state.mySpaces.filter((space) => { // eslint-disable-line no-case-declarations
                if (!action.data || !action.data.ids) {
                    return true;
                }
                return !action.data.ids.includes(space.id);
            });
            return state.setIn(['mySpaces'], modifiedMySpace);
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
                .setIn(['myMoments'], Immutable.from([]));
        // // // // // // // // // // // //
        case MapActionTypes.SET_MAP_FILTERS:
            return state.setIn(['filtersAuthor'], action.data.filtersAuthor)
                .setIn(['filtersCategory'], action.data.filtersCategory)
                .setIn(['filtersVisibility'], action.data.filtersVisibility);
        default:
            return state;
    }
};

export default map;
