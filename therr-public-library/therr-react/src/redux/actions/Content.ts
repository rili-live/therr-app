import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import ReactionsService, {
    ISearchActiveAreasParams,
    ICreateOrUpdateEventReactionBody,
    ICreateOrUpdateAreaReactionBody,
    ISearchActiveAreasByIdsParams,
    ICreateOrUpdateSpaceReactionBody,
} from '../../services/ReactionsService';
import { ContentActionTypes } from '../../types/redux/content';
import { ISearchAreasArgs } from '../../services/MapsService';
import { MapsService } from '../../services';
import { ISearchQuery } from '../../types';
import { isOfflineError } from '../../utilities/cacheHelpers';

const POST_FEED_PAGE_SIZE = 31;

interface IActiveMomentsFilters {
    order?: 'ASC' | 'DESC';
    contentType?: 'all' | 'moments' | 'thoughts';
}

const Content = {
    // Events
    insertActiveEvents: (newActiveEvents: any) => (dispatch: any) => {
        dispatch({
            type: ContentActionTypes.INSERT_ACTIVE_EVENTS,
            data: newActiveEvents,
        });
    },
    searchActiveEvents: (options: ISearchActiveAreasParams, limit = POST_FEED_PAGE_SIZE) => (dispatch: any) => ReactionsService
        .searchActiveEvents(options, limit)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_EVENTS,
                data: response?.data,
            });
        })
        .catch((err) => { if (!isOfflineError(err)) { console.log(err); throw err; } }),
    searchActiveEventsByIds: (options: ISearchActiveAreasByIdsParams, ids: string[]) => (dispatch: any) => ReactionsService
        .searchActiveEventsByIds(options, ids)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_EVENTS_BY_IDS,
                data: response?.data,
            });
        })
        .catch((err) => { console.log(err); throw err; }),
    updateActiveEventsStream: (options: ISearchActiveAreasParams, limit = POST_FEED_PAGE_SIZE) => (dispatch: any) => ReactionsService
        .searchActiveEvents(options, limit)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_EVENTS,
                data: response?.data,
            });
        })
        .catch((err) => { console.log(err); throw err; }),
    createOrUpdateEventReaction: (
        eventId: number,
        params: ICreateOrUpdateEventReactionBody,
        eventUserId: string,
        reactorUserName: string,
    ) => (dispatch: any) => ReactionsService
        .createOrUpdateEventReaction(eventId, params)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_EVENT_REACTION,
                data: response?.data,
            });
            dispatch({
                type: SocketClientActionTypes.CREATE_OR_UPDATE_REACTION,
                data: {
                    areaUserId: eventUserId,
                    reactorUserName,
                    eventReaction: response?.data,
                },
            });
            if (params?.userHasReported) {
                dispatch({
                    type: ContentActionTypes.REMOVE_ACTIVE_EVENTS,
                    data: {
                        eventId,
                    },
                });
            }
        })
        .catch((err) => { console.log(err); throw err; }),
    searchBookmarkedEvents: (options: ISearchActiveAreasParams) => (dispatch: any) => ReactionsService
        .searchBookmarkedEvents(options, 100)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.SEARCH_BOOKMARKED_EVENTS,
                data: response?.data,
            });
        })
        .catch((err) => { console.log(err); throw err; }),

    // Moments
    insertActiveMoments: (newActiveMoments: any) => (dispatch: any) => dispatch({
        type: ContentActionTypes.INSERT_ACTIVE_MOMENTS,
        data: newActiveMoments,
    }),
    searchActiveMoments: (
        options: ISearchActiveAreasParams,
        limit = POST_FEED_PAGE_SIZE,
    ) => (dispatch: any) => ReactionsService
        .searchActiveMoments(options, limit)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_MOMENTS,
                data: response?.data,
            });
        })
        .catch((err) => { if (!isOfflineError(err)) { console.log(err); throw err; } }),
    searchActiveMomentsByIds: (options: ISearchActiveAreasByIdsParams, ids: string[]) => (dispatch: any) => ReactionsService
        .searchActiveMomentsByIds(options, ids)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_MOMENTS_BY_IDS,
                data: response?.data,
            });
        })
        .catch((err) => { console.log(err); throw err; }),
    setActiveMomentsFilters: (filters: IActiveMomentsFilters) => (dispatch: any) => dispatch({
        type: ContentActionTypes.SET_ACTIVE_AREAS_FILTERS,
        data: filters,
    }),
    updateActiveMomentsStream: (options: ISearchActiveAreasParams, limit = POST_FEED_PAGE_SIZE) => (dispatch: any) => ReactionsService
        .searchActiveMoments(options, limit)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_MOMENTS,
                data: response?.data,
            });
        })
        .catch((err) => { console.log(err); throw err; }),
    createOrUpdateMomentReaction: (
        momentId: number,
        params: ICreateOrUpdateAreaReactionBody,
        momentUserId: string,
        reactorUserName: string,
    ) => (dispatch: any) => ReactionsService
        .createOrUpdateMomentReaction(momentId, params)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_MOMENT_REACTION,
                data: response?.data,
            });
            dispatch({
                type: SocketClientActionTypes.CREATE_OR_UPDATE_REACTION,
                data: {
                    areaUserId: momentUserId,
                    momentReaction: response?.data,
                    reactorUserName,
                },
            });
            if (params?.userHasReported) {
                dispatch({
                    type: ContentActionTypes.REMOVE_ACTIVE_MOMENTS,
                    data: {
                        momentId,
                    },
                });
            }
        })
        .catch((err) => { console.log(err); throw err; }),
    searchBookmarkedMoments: (options: ISearchActiveAreasParams) => (dispatch: any) => ReactionsService
        .searchBookmarkedMoments(options, 100)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.SEARCH_BOOKMARKED_MOMENTS,
                data: response?.data,
            });
        })
        .catch((err) => { console.log(err); throw err; }),
    searchMyDrafts: (query: ISearchQuery, data: ISearchAreasArgs = {}) => (dispatch: any) => MapsService
        .searchMyMoments(query, data).then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.SEARCH_MY_DRAFTS,
                data: response.data,
            });
        })
        .catch((err) => { if (!isOfflineError(err)) { console.log(err); throw err; } }),
    deleteDraft: (id: string) => (dispatch: any) => MapsService.deleteMoments({ ids: [id] }).then(() => {
        dispatch({
            type: ContentActionTypes.MOMENT_DRAFT_DELETED,
            data: {
                id,
            },
        });
    })
        .catch((err) => { console.log(err); throw err; }),

    // Spaces
    insertActiveSpaces: (newActiveSpaces: any) => (dispatch: any) => {
        dispatch({
            type: ContentActionTypes.INSERT_ACTIVE_SPACES,
            data: newActiveSpaces,
        });
    },
    searchActiveSpaces: (options: ISearchActiveAreasParams, limit = POST_FEED_PAGE_SIZE) => (dispatch: any) => ReactionsService
        .searchActiveSpaces(options, limit)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_SPACES,
                data: response?.data,
            });
        })
        .catch((err) => { if (!isOfflineError(err)) { console.log(err); throw err; } }),
    searchActiveSpacesByIds: (options: ISearchActiveAreasByIdsParams, ids: string[]) => (dispatch: any) => ReactionsService
        .searchActiveSpacesByIds(options, ids)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_SPACES_BY_IDS,
                data: response?.data,
            });
        })
        .catch((err) => { console.log(err); throw err; }),
    updateActiveSpacesStream: (options: ISearchActiveAreasParams, limit = POST_FEED_PAGE_SIZE) => (dispatch: any) => ReactionsService
        .searchActiveSpaces(options, limit)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_SPACES,
                data: response?.data,
            });
        })
        .catch((err) => { console.log(err); throw err; }),
    createOrUpdateSpaceReaction: (
        spaceId: number,
        params: ICreateOrUpdateSpaceReactionBody,
        spaceUserId: string,
        reactorUserName: string,
    ) => (dispatch: any) => ReactionsService
        .createOrUpdateSpaceReaction(spaceId, params)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_SPACE_REACTION,
                data: response?.data,
            });
            dispatch({
                type: SocketClientActionTypes.CREATE_OR_UPDATE_REACTION,
                data: {
                    areaUserId: spaceUserId,
                    reactorUserName,
                    spaceReaction: response?.data,
                },
            });
            if (params?.userHasReported) {
                dispatch({
                    type: ContentActionTypes.REMOVE_ACTIVE_SPACES,
                    data: {
                        spaceId,
                    },
                });
            }
        })
        .catch((err) => { console.log(err); throw err; }),
    searchBookmarkedSpaces: (options: ISearchActiveAreasParams) => (dispatch: any) => ReactionsService
        .searchBookmarkedSpaces(options, 100)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.SEARCH_BOOKMARKED_SPACES,
                data: response?.data,
            });
        })
        .catch((err) => { console.log(err); throw err; }),

    // Thoughts
    insertActiveThoughts: (newActiveThoughts: any) => (dispatch: any) => {
        dispatch({
            type: ContentActionTypes.INSERT_ACTIVE_THOUGHTS,
            data: newActiveThoughts,
        });
    },
    searchActiveThoughts: (options: ISearchActiveAreasParams, limit = POST_FEED_PAGE_SIZE) => (dispatch: any) => ReactionsService
        .searchActiveThoughts(options, limit)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_THOUGHTS,
                data: response?.data,
            });
        })
        .catch((err) => { if (!isOfflineError(err)) { console.log(err); throw err; } }),
    updateActiveThoughtsStream: (options: ISearchActiveAreasParams, limit = POST_FEED_PAGE_SIZE) => (dispatch: any) => ReactionsService
        .searchActiveThoughts(options, limit)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_THOUGHTS,
                data: response?.data,
            });

            return response?.data;
        })
        .catch((err) => { console.log(err); throw err; }),
    createOrUpdateThoughtReaction: (
        thoughtId: number,
        params: ICreateOrUpdateAreaReactionBody,
        thoughtUserId: string,
        reactorUserName: string,
    ) => (dispatch: any) => ReactionsService
        .createOrUpdateThoughtReaction(thoughtId, params)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_THOUGHT_REACTION,
                data: response?.data,
            });
            dispatch({
                type: SocketClientActionTypes.CREATE_OR_UPDATE_REACTION,
                data: {
                    thoughtUserId,
                    reactorUserName,
                    thoughtReaction: response?.data,
                },
            });
            if (params?.userHasReported) {
                dispatch({
                    type: ContentActionTypes.REMOVE_ACTIVE_THOUGHTS,
                    data: {
                        thoughtId,
                    },
                });
            }
            return response?.data;
        })
        .catch((err) => { console.log(err); throw err; }),
    searchBookmarkedThoughts: (options: ISearchActiveAreasParams) => (dispatch: any) => ReactionsService
        .searchBookmarkedThoughts(options, 100)
        .then((response: any) => {
            if (response?.isOfflineFallback) return;
            dispatch({
                type: ContentActionTypes.SEARCH_BOOKMARKED_THOUGHTS,
                data: response?.data,
            });
        })
        .catch((err) => { console.log(err); throw err; }),
};

export default Content;
