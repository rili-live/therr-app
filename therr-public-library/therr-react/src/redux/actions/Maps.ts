import { MapActionTypes } from '../../types/redux/maps';
import { UserActionTypes } from '../../types/redux/user';
import MapsService, {
    ICreateSpaceCheckInMetricsArgs, IGetSpaceMetricsArgs, IPlacesAutoCompleteArgs, ISearchAreasArgs,
} from '../../services/MapsService';
import { ContentActionTypes } from '../../types';

interface IMapFilters {
    filtersAuthor: any[],
    filtersCategory: any[],
    filtersVisibility: any[],
}

export type IEngagementTypes = 'check-in' | 'moment';

const Maps = {
    // Media
    fetchMedia: (mediaIds: string[]) => (dispatch: any) => MapsService.fetchMedia(mediaIds).then((response: any) => {
        dispatch({
            type: ContentActionTypes.FETCH_MEDIA,
            data: response.data.media,
        });

        return response?.data;
    }),

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

        if (data.spaceId) {
            dispatch({
                type: MapActionTypes.UPDATE_RECENT_ENGAGEMENTS,
                data: {
                    spaceId: data.spaceId,
                    engagementType: 'moment',
                    timestamp: Date.now(),
                },
            });
        }

        return response?.data;
    }),
    createIntegratedMoment: (platform: string, accessToken: string, externalMediaId: string) => (dispatch: any) => MapsService
        .createIntegratedMoment(platform, accessToken, externalMediaId).then((response: any) => {
            dispatch({
                type: MapActionTypes.MOMENT_CREATED,
                data: response.data,
            });
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
                data: {
                    moment: {}, // sometimes moment is undefined if recently deleted
                    ...response.data,
                },
            });

            return response.data;
        }),
    getIntegratedMoments: (userId: string) => (dispatch: any) => MapsService.getIntegratedMoments(userId)
        .then((response: any) => {
            // TODO: Dispatch something
            dispatch({
                type: ContentActionTypes.FETCH_MEDIA,
                data: response.data.media,
            });
            dispatch({
                type: UserActionTypes.UPDATE_USER_IN_VIEW,
                data: {
                    externalIntegrations: response.data.externalIntegrations,
                },
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

            // Return so we can react by searching for associated reactions
            return Promise.resolve(response.data);
        }),
    deleteMoment: (args: { ids: string[] }) => (dispatch: any) => MapsService.deleteMoments(args).then(() => {
        dispatch({
            type: MapActionTypes.MOMENT_DELETED,
            data: {
                ids: args.ids,
            },
        });
        args.ids.forEach((id) => {
            dispatch({
                type: ContentActionTypes.REMOVE_ACTIVE_MOMENTS,
                data: {
                    momentId: id,
                },
            });
        });
    }),

    // Spaces
    createSpace: (data: any) => (dispatch: any) => MapsService.createSpace(data).then((response: any) => {
        dispatch({
            type: MapActionTypes.SPACE_CREATED,
            data: response.data,
        });
    }),
    updateSpace: (id: string, data: any, isCompletedDraft: false) => (dispatch: any) => MapsService
        .updateSpace(id, data).then((response: any) => {
            if (isCompletedDraft) {
                dispatch({
                    type: MapActionTypes.SPACE_CREATED,
                    data: {
                        id: response.data.id,
                        ...data,
                    }, // server doesn't return changes, so use request data
                });
            }

            // TODO: Not sure if this is necessary if transitioning from draft, but it doesn't hurt
            dispatch({
                type: MapActionTypes.SPACE_UPDATED,
                data: {
                    space: {
                        id: response.data.id,
                        ...data,
                    },
                }, // server doesn't return changes, so use request data
            });

            return response.data;
        }),
    getSpaceDetails: (id: number, data: any) => (dispatch: any) => MapsService.getSpaceDetails(id, data)
        .then((response: any) => {
            dispatch({
                type: MapActionTypes.GET_SPACE_DETAILS,
                data: {
                    space: {}, // Sometimes space is undefined if recently deleted
                    ...response.data,
                },
            });

            return response.data;
        }),
    listSpaces: (query: any, data: ISearchAreasArgs = {}) => (dispatch: any) => MapsService
        .listSpaces(query, data).then((response: any) => {
            dispatch({
                type: MapActionTypes.LIST_SPACES,
                data: response.data,
            });

            // Return so we can react by searching for associated reactions
            return Promise.resolve(response.data);
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

            // Return so we can react by searching for associated reactions
            return Promise.resolve(response.data);
        }),
    deleteSpace: (args: { ids: string[] }) => (dispatch: any) => MapsService.deleteSpaces(args).then(() => {
        dispatch({
            type: MapActionTypes.SPACE_DELETED,
            data: {
                ids: args.ids,
            },
        });
        args.ids.forEach((id) => {
            dispatch({
                type: ContentActionTypes.REMOVE_ACTIVE_SPACES,
                data: {
                    spaceId: id,
                },
            });
        });
    }),

    // Filters
    setMapFilters: (filters: IMapFilters) => (dispatch: any) => dispatch({
        type: MapActionTypes.SET_MAP_FILTERS,
        data: filters,
    }),

    // Location
    updateUserCoordinates: (data: any) => (dispatch: any) => {
        dispatch({
            type: MapActionTypes.UPDATE_USER_COORDS,
            data,
        });
    },
    updateMapViewCoordinates: (data: any) => (dispatch: any) => {
        dispatch({
            type: MapActionTypes.UPDATE_MAP_VIEW_COORDS,
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

    // Map Metrics
    getSpaceMetrics: (spaceId: string, args: IGetSpaceMetricsArgs) => (dispatch: any) => MapsService
        .getSpaceMetrics(spaceId, args).then((response) => response.data),

    createSpaceCheckInMetrics: (args: ICreateSpaceCheckInMetricsArgs) => (dispatch: any) => MapsService
        .createSpaceCheckInMetrics(args).then((response) => {
            dispatch({
                type: MapActionTypes.UPDATE_RECENT_ENGAGEMENTS,
                data: {
                    spaceId: args.spaceId,
                    engagementType: 'check-in',
                    timestamp: Date.now(),
                },
            });
            return response.data;
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
