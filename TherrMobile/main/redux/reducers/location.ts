import Immutable from 'seamless-immutable';
// import { SocketServerActionTypes } from 'therr-js-utilities/constants';
import { MapActionTypes } from 'therr-react/types';
import {
    ILocationState,
    LocationActionTypes,
} from '../../types/redux/location';

const initialState: ILocationState = Immutable.from({
    permissions: {},
    settings: {},
    user: {},
});

const locations = (state: ILocationState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState;
    }

    switch (action.type) {
        case LocationActionTypes.LOCATION_DISCLOSURE_UPDATED:
            return state.setIn(
                ['settings', 'isLocationDislosureComplete'],
                !!action.data?.complete
            );
        case LocationActionTypes.GPS_STATUS_UPDATED:
            return state.setIn(
                ['settings', 'isGpsEnabled'],
                action.data?.status === 'enabled'
            );
        case LocationActionTypes.LOCATION_PERMISSIONS_UPDATED:
            return state.setIn(['permissions'], {
                ...state.permissions,
                ...action.data,
            });
        case MapActionTypes.UPDATE_COORDS:
            return state
                .setIn(['user', 'longitude'], action.data.longitude)
                .setIn(['user', 'latitude'], action.data.latitude)
                .setIn(['user', 'prevLongitude'], state.longitude)
                .setIn(['user', 'prevLatitude'], state.latitude);
        default:
            return state;
    }
};

export default locations;
