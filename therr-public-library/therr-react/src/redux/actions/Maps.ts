import { MapActionTypes } from '../../types/redux/maps';
import MapsService from '../../services/MapsService';

const Maps = {
    create: (data: any) => (dispatch: any) => MapsService.createMoment(data).then((response: any) => {
        dispatch({
            type: MapActionTypes.MOMENT_CREATED,
            data: response.data,
        });
    }),
    search: (query: any) => (dispatch: any) => MapsService.searchMoments(query).then((response: any) => {
        dispatch({
            type: MapActionTypes.GET_MOMENTS,
            data: response.data,
        });
    }),
};

export default Maps;
