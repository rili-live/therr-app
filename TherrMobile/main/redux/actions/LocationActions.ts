import { LocationActionTypes } from '../../types/redux/location';

const Location = {
    updateGpsStatus: (status) => (dispatch: any) => {
        dispatch({
            type: LocationActionTypes.GPS_STATUS_UPDATED,
            data: {
                status,
            },
        });
    },
};

export default Location;
