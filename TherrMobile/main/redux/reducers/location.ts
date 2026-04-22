import { produce } from 'immer';
import { MapActionTypes } from 'therr-react/types';
import {
    ILocationState,
    LocationActionTypes,
} from '../../types/redux/location';

const initialState: ILocationState = {
    permissions: {},
    settings: {},
    user: {},
};

const locations = produce((draft: ILocationState, action: any) => {
    switch (action.type) {
        case LocationActionTypes.LOCATION_DISCLOSURE_UPDATED:
            if (!draft.settings) draft.settings = {};
            draft.settings.isLocationDislosureComplete = !!action.data?.complete;
            break;
        case LocationActionTypes.GPS_STATUS_UPDATED:
            if (!draft.settings) draft.settings = {};
            draft.settings.isGpsEnabled = action.data?.status === 'enabled';
            break;
        case LocationActionTypes.LOCATION_PERMISSIONS_UPDATED:
            draft.permissions = {
                ...draft.permissions,
                ...action.data,
            };
            break;
        case MapActionTypes.UPDATE_USER_COORDS:
            if (!draft.user) draft.user = {};
            draft.user.prevLongitude = draft.user?.longitude;
            draft.user.prevLatitude = draft.user?.latitude;
            draft.user.longitude = action.data.longitude || draft.user?.longitude;
            draft.user.latitude = action.data.latitude || draft.user?.latitude;
            break;
        default:
            break;
    }
}, initialState);

export default locations;
