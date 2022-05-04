import { MapActionTypes } from '../../types/redux/maps';
import MapsService, { IPlacesAutoCompleteArgs, ISearchAreasArgs } from '../../services/MapsService';
import { ContentActionTypes } from '../../types';

const Maps = {
    // Moments
    createMoment: (data: any) => (dispatch: any) => MapsService.createMoment(data).then((response: any) => {
        if (data.isDraft) {
            dispatch({
                type: ContentActionTypes.MOMENT_DRAFT_CREATED,
                data: response.data,
            });
        } else {
            dispatch({
                type: MapActionTypes.MOMENT_CREATED,
                data: response.data,
            });
        }
    }),
    updateMoment: (id: string, data: any, isCompletedDraft: false) => (dispatch: any) => MapsService
        .updateMoment(id, data).then((response: any) => {
            if (isCompletedDraft) {
                dispatch({
                    type: MapActionTypes.MOMENT_CREATED,
                    data: {
                        id: response.data.id,
                        ...data,
                    }, // server doesn't return changes, so use request data
                });
            }

            // TODO: Not sure if this is necessary if transitioning from draft, but it doesn't hurt
            dispatch({
                type: MapActionTypes.MOMENT_UPDATED,
                data: {
                    id: response.data.id,
                    ...data,
                }, // server doesn't return changes, so use request data
            });
        }),
    getMomentDetails: (id: number, data: any) => (dispatch: any) => MapsService.getMomentDetails(id, data)
        .then((response: any) => {
            dispatch({
                type: MapActionTypes.GET_MOMENT_DETAILS,
                data: response.data,
            });
        }),
    searchMoments: (query: any, data: ISearchAreasArgs = {}) => (dispatch: any) => MapsService
        .searchMoments(query, data).then((response: any) => {
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

    // Spaces
    createSpace: (data: any) => (dispatch: any) => MapsService.createSpace(data).then((response: any) => {
        dispatch({
            type: MapActionTypes.SPACE_CREATED,
            data: response.data,
        });
    }),
    getSpaceDetails: (id: number, data: any) => (dispatch: any) => MapsService.getSpaceDetails(id, data)
        .then((response: any) => {
            dispatch({
                type: MapActionTypes.GET_SPACE_DETAILS,
                data: response.data,
            });
        }),
    searchSpaces: (query: any, data: ISearchAreasArgs = {}) => (dispatch: any) => MapsService
        .searchSpaces(query, data).then((response: any) => {
            if (query.query === 'connections') {
                dispatch({
                    type: MapActionTypes.GET_SPACES,
                    data: response.data,
                });
            }

            if (query.query === 'me') {
                dispatch({
                    type: MapActionTypes.GET_MY_SPACES,
                    data: response.data,
                });
            }
        }),
    deleteSpace: (args: { ids: string[] }) => (dispatch: any) => MapsService.deleteSpaces(args).then(() => {
        dispatch({
            type: MapActionTypes.SPACE_DELETED,
            data: {
                ids: args.ids,
            },
        });
    }),

    // Location
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
    updateUserRadius: (data: {
        radiusOfAwareness: number,
        radiusOfInfluence: number,
    }) => (dispatch: any) => {
        dispatch({
            type: MapActionTypes.UPDATE_USER_RADIUS,
            data,
        });
    },

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
