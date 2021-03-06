import { MapActionTypes } from '../../types/redux/maps';
import MapsService from '../../services/MapsService';

const Maps = {
    createMoment: (data: any) => (dispatch: any) => MapsService.createMoment(data).then((response: any) => {
        dispatch({
            type: MapActionTypes.MOMENT_CREATED,
            data: response.data,
        });
    }),
    updateCoordinates: (data: any) => (dispatch: any) => {
        dispatch({
            type: MapActionTypes.UPDATE_COORDS,
            data,
        });
    },
    searchMoments: (query: any) => (dispatch: any) => MapsService.searchMoments(query).then((response: any) => {
        if (query.query === 'connections') {
            dispatch({
                type: MapActionTypes.GET_MOMENTS,
                data: response.data,
            });
        }

        if (query.query === 'me') {
            dispatch({
                type: MapActionTypes.GET_MY_MOMENTS,
                data: response.data,
            });
        }
    }),
    deleteMoment: (args: { ids: string[] }) => (dispatch: any) => MapsService.deleteMoments(args).then(() => {
        dispatch({
            type: MapActionTypes.MOMENT_DELETED,
            data: {
                ids: args.ids,
            },
        });
    }),
};

export default Maps;
