import * as Immutable from 'seamless-immutable';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { IMapState, MapActionTypes } from '../../types/redux/maps';

const initialState: IMapState = Immutable.from({
    moments: Immutable.from([]),
    myMoments: Immutable.from([]),
});

const map = (state: IMapState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    const modifiedMoment = [...state.moments];
    let modifiedMyMoment = [...state.myMoments];

    switch (action.type) {
        // TODO: Rethink this
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
        case MapActionTypes.UPDATE_COORDS:
            return state
                .setIn(['longitude'], action.data.longitude)
                .setIn(['latitude'], action.data.latitude)
                .setIn(['prevLongitude'], state.longitude)
                .setIn(['prevLatitude'], state.latitude);
        case MapActionTypes.USER_LOCATION_DETERMINED:
            return state.setIn(['hasUserLocationLoaded'], true);
        case SocketClientActionTypes.LOGOUT:
            return state
                .setIn(['hasUserLocationLoaded'], false)
                .setIn(['myMoments'], Immutable.from([]));
        default:
            return state;
    }
};

export default map;
