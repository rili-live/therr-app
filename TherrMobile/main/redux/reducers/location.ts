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
        case MapActionTypes.UPDATE_USER_COORDS:
            return state
                .setIn(['user', 'prevLongitude'], state.user?.longitude)
                .setIn(['user', 'prevLatitude'], state.user?.latitude)
                .setIn(['user', 'longitude'], action.data.longitude || state.user?.longitude)
                .setIn(['user', 'latitude'], action.data.latitude || state.user?.latitude);
        default:
            return state;
    }
};

export default locations;
