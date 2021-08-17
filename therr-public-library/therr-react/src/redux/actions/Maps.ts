import { MapActionTypes } from '../../types/redux/maps';
import MapsService, { IPlacesAutoCompleteArgs } from '../../services/MapsService';

const Maps = {
    createMoment: (data: any) => (dispatch: any) => MapsService.createMoment(data).then((response: any) => {
        dispatch({
            type: MapActionTypes.MOMENT_CREATED,
            data: response.data,
        });
    }),
    getMomentDetails: (momentId: number, data: any) => (dispatch: any) => MapsService.getMomentDetails(momentId, data)
        .then((response: any) => {
            dispatch({
                type: MapActionTypes.GET_MOMENT_DETAILS,
                data: response.data,
            });
        }),
    updateCoordinates: (data: any) => (dispatch: any) => {
        dispatch({
            type: MapActionTypes.UPDATE_COORDS,
            data,
        });
    },
    setInitialUserLocation: () => (dispatch: any) => {
        dispatch({
            type: MapActionTypes.USER_LOCATION_DETERMINED,
            data: {},
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

    // Google API
    getPlacesSearchAutoComplete: (args: IPlacesAutoCompleteArgs) => (dispatch: any) => MapsService.getPlacesSearchAutoComplete(args)
        .then((response) => {
            dispatch({
                type: MapActionTypes.AUTOCOMPLETE_UPDATE,
                data: {
                    predictions: response.data?.predictions || [],
                },
            });
        })
        .catch((error) => {
            console.log(error);
        }),
    setSearchDropdownVisibility: (isVisible: boolean) => (dispatch: any) => {
        dispatch({
            type: MapActionTypes.SET_DROPDOWN_VISIBILITY,
            data: {
                isSearchDropdownVisible: isVisible,
            },
        });
    },
};

export default Maps;
