import { LocationActionTypes } from '../../types/redux/location';

const Location = {
    updateGpsStatus: (status) => (dispatch: any) => {
        dispatch({
            type: LocationActionTypes.GPS_STATUS_UPDATED,
            data: {
                status,
            },
        });
        return Promise.resolve();
    },
    updateLocationDisclosure: (isAcknowledged: boolean) => (dispatch: any) => {
        dispatch({
            type: LocationActionTypes.LOCATION_DISCLOSURE_UPDATED,
            data: {
                complete: isAcknowledged,
            },
        });
        return Promise.resolve();
    },
    updateLocationPermissions: (permissions) => (dispatch: any) => {
        dispatch({
            type: LocationActionTypes.LOCATION_PERMISSIONS_UPDATED,
            data: permissions,
        });
        return Promise.resolve();
    },
};

export default Location;
