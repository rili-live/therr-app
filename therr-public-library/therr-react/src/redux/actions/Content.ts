import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import ReactionsService, {
    ISearchActiveAreasParams,
    ICreateOrUpdateAreaReactionBody,
    ISearchActiveAreasByIdsParams,
    ICreateOrUpdateSpaceReactionBody,
} from '../../services/ReactionsService';
import { ContentActionTypes } from '../../types/redux/content';
import { ISearchAreasArgs } from '../../services/MapsService';
import { MapsService } from '../../services';
import { ISearchQuery } from '../../types';

interface IActiveMomentsFilters {
    order: 'ASC' | 'DESC';
}

const Content = {
    // Moments
    insertActiveMoments: (newActiveMoments: any) => (dispatch: any) => dispatch({
        type: ContentActionTypes.INSERT_ACTIVE_MOMENTS,
        data: newActiveMoments,
    }),
    searchActiveMoments: (options: ISearchActiveAreasParams,
        limit = 21) => (dispatch: any) => ReactionsService
        .searchActiveMoments(options, limit)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_MOMENTS,
                data: response?.data,
            });
        }),
    searchActiveMomentsByIds: (options: ISearchActiveAreasByIdsParams, ids: string[]) => (dispatch: any) => ReactionsService
        .searchActiveMomentsByIds(options, ids)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_MOMENTS_BY_IDS,
                data: response?.data,
            });
        }),
    setActiveMomentsFilters: (filters: IActiveMomentsFilters) => (dispatch: any) => dispatch({
        type: ContentActionTypes.SET_ACTIVE_AREAS_FILTERS,
        data: filters,
    }),
    updateActiveMomentsStream: (options: ISearchActiveAreasParams, limit = 21) => (dispatch: any) => ReactionsService
        .searchActiveMoments(options, limit)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_MOMENTS,
                data: response?.data,
            });
        }),
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
        }),
    searchBookmarkedMoments: (options: ISearchActiveAreasParams) => (dispatch: any) => ReactionsService
        .searchBookmarkedMoments(options, 100)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.SEARCH_BOOKMARKED_MOMENTS,
                data: response?.data,
            });
        }),
    searchMyDrafts: (query: ISearchQuery, data: ISearchAreasArgs = {}) => (dispatch: any) => MapsService
        .searchMyMoments(query, data).then((response: any) => {
            dispatch({
                type: ContentActionTypes.SEARCH_MY_DRAFTS,
                data: response.data,
            });
        }),
    deleteDraft: (id: string) => (dispatch: any) => MapsService.deleteMoments({ ids: [id] }).then(() => {
        dispatch({
            type: ContentActionTypes.MOMENT_DRAFT_DELETED,
            data: {
                id,
            },
        });
    }),

    // Spaces
    insertActiveSpaces: (newActiveSpaces: any) => (dispatch: any) => {
        dispatch({
            type: ContentActionTypes.INSERT_ACTIVE_SPACES,
            data: newActiveSpaces,
        });
    },
    searchActiveSpaces: (options: ISearchActiveAreasParams, limit = 21) => (dispatch: any) => ReactionsService
        .searchActiveSpaces(options, limit)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_SPACES,
                data: response?.data,
            });
        }),
    searchActiveSpacesByIds: (options: ISearchActiveAreasByIdsParams, ids: string[]) => (dispatch: any) => ReactionsService
        .searchActiveSpacesByIds(options, ids)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_SPACES_BY_IDS,
                data: response?.data,
            });
        }),
    updateActiveSpacesStream: (options: ISearchActiveAreasParams, limit = 21) => (dispatch: any) => ReactionsService
        .searchActiveSpaces(options, limit)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_SPACES,
                data: response?.data,
            });
        }),
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
        }),
    searchBookmarkedSpaces: (options: ISearchActiveAreasParams) => (dispatch: any) => ReactionsService
        .searchBookmarkedSpaces(options, 100)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.SEARCH_BOOKMARKED_SPACES,
                data: response?.data,
            });
        }),

    // Thoughts
    insertActiveThoughts: (newActiveThoughts: any) => (dispatch: any) => {
        dispatch({
            type: ContentActionTypes.INSERT_ACTIVE_THOUGHTS,
            data: newActiveThoughts,
        });
    },
    searchActiveThoughts: (options: ISearchActiveAreasParams, limit = 21) => (dispatch: any) => ReactionsService
        .searchActiveThoughts(options, limit)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.SEARCH_ACTIVE_THOUGHTS,
                data: response?.data,
            });
        }),
    updateActiveThoughtsStream: (options: ISearchActiveAreasParams, limit = 21) => (dispatch: any) => ReactionsService
        .searchActiveThoughts(options, limit)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.UPDATE_ACTIVE_THOUGHTS,
                data: response?.data,
            });

            return response?.data;
        }),
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
        }),
    searchBookmarkedThoughts: (options: ISearchActiveAreasParams) => (dispatch: any) => ReactionsService
        .searchBookmarkedThoughts(options, 100)
        .then((response: any) => {
            dispatch({
                type: ContentActionTypes.SEARCH_BOOKMARKED_THOUGHTS,
                data: response?.data,
            });
        }),
};

export default Content;
