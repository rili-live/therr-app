import Immutable from 'seamless-immutable';
// import { SocketServerActionTypes } from 'therr-js-utilities/constants';
import {
    ILocationState,
    LocationActionTypes,
} from '../../types/redux/location';

const initialState: ILocationState = Immutable.from({
    permissions: {},
    settings: {},
});

const locations = (state: ILocationState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    switch (action.type) {
        case LocationActionTypes.GPS_STATUS_UPDATED:
            return state.setIn(
                ['settings', 'isGpsEnabled'],
                action.data && action.data.status === 'enabled'
            );
        case LocationActionTypes.LOCATION_PERMISSIONS_UPDATED:
            return state.setIn(['permissions'], {
                ...state.permissions,
                ...action.data,
            });
        default:
            return state;
    }
};

export default locations;
