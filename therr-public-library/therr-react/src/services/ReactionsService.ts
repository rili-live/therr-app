/* eslint-disable class-methods-use-this */
import axios from 'axios';
// eslint-disable-next-line import/extensions, import/no-unresolved
import { IAreaType, IPostType } from 'therr-js-utilities/types';

export interface ICreateAreaReactionBody {
    userId: number;
    userViewCount?: number;
    userHasActivated?: boolean;
    userHasLiked?: boolean;
    userHasSuperLiked?: boolean;
    userHasDisliked?: boolean;
    userHasSuperDisliked?: boolean;
}

export interface ICreateOrUpdateAreaReactionBody {
    userViewCount?: number;
    userHasActivated?: boolean;
    userHasLiked?: boolean;
    userHasReported?: boolean;
    userHasSuperLiked?: boolean;
    userHasDisliked?: boolean;
    userHasSuperDisliked?: boolean;
}
export interface ISearchActiveAreasParams {
    offset: number;
    order?: string;
    blockedUsers?: number[];
    shouldHideMatureContent?: boolean;
    withMedia: boolean;
    withUser: boolean;
    withReplies?: boolean;
    userLatitude?: number;
    userLongitude?: number,
    lastContentCreatedAt?: Date;
    authorId?: string;
}
export interface ISearchActiveAreasByIdsParams {
    blockedUsers?: number[];
    shouldHideMatureContent?: boolean;
    withMedia: boolean;
    withUser: boolean;
    withReplies?: boolean;
    userLatitude?: number;
    userLongitude?: number,
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ISearchBookmarkedAreasParams extends ISearchActiveAreasParams {}

export interface ICreateMomentReactionBody extends ICreateAreaReactionBody {
    momentId: number;
}
export interface IGetMomentReactionParams {
    limit?: number;
    momentId?: number;
    momentIds?: number[];
}

export interface IFindMomentReactionParams {
    limit?: number;
    offset?: number;
    order?: number;
    momentIds?: number[];
    userHasActivated?: boolean;
}
export interface ICreateSpaceReactionBody extends ICreateAreaReactionBody {
    spaceId: number;
    rating?: number;
}
export interface ICreateOrUpdateSpaceReactionBody extends ICreateOrUpdateAreaReactionBody {
    spaceId: number;
    rating?: number;
}

export interface IGetSpaceReactionParams {
    limit?: number;
    spaceId?: number;
    spaceIds?: number[];
}

export interface IFindSpaceReactionParams {
    limit?: number;
    offset?: number;
    order?: number;
    spaceIds?: number[];
    userHasActivated?: boolean;
}

export interface IGetThoughtReactionParams {
    limit?: number;
    thoughtId?: number;
    thoughtIds?: number[];
}

export interface IFindThoughtReactionParams {
    limit?: number;
    offset?: number;
    order?: number;
    thoughtIds?: number[];
    userHasActivated?: boolean;
}

class ReactionsService {
    createOrUpdatePostReaction = (postType: IPostType, id: number, data: ICreateOrUpdateAreaReactionBody) => {
        const typeSingular = postType.replace(/s$/, '');

        return axios({
            method: 'post',
            url: `/reactions-service/${typeSingular}-reactions/${id}`,
            data,
        });
    };

    searchActivePosts = (postType: IPostType, options: ISearchActiveAreasParams, limit = 21) => axios({
        method: 'post',
        url: `/reactions-service/${postType}/active/search`,
        data: {
            offset: options.offset,
            limit,
            order: options.order,
            blockedUsers: options.blockedUsers || [],
            shouldHideMatureContent: !!options.shouldHideMatureContent,
            withMedia: options.withMedia,
            withUser: options.withUser,
            withReplies: options.withReplies,
            userLatitude: options.userLatitude,
            userLongitude: options.userLongitude,
            lastContentCreatedAt: options.lastContentCreatedAt,
            authorId: options.authorId,
        },
    });

    searchActivePostsByIds = (postType: IAreaType, options: ISearchActiveAreasByIdsParams, ids: string[]) => {
        const data: any = {
            blockedUsers: options.blockedUsers || [],
            shouldHideMatureContent: !!options.shouldHideMatureContent,
            withMedia: options.withMedia,
            withUser: options.withUser,
            withReplies: options.withReplies,
            userLatitude: options.userLatitude,
            userLongitude: options.userLongitude,
        };
        if (postType === 'moments') {
            data.momentIds = ids;
        }
        if (postType === 'spaces') {
            data.spaceIds = ids;
        }
        return axios({
            method: 'post',
            url: `/reactions-service/${postType}/active/search/ids`,
            data,
        });
    };

    searchBookmarkedAreas = (areaType: IAreaType, options: ISearchBookmarkedAreasParams, limit = 21) => axios({
        method: 'post',
        url: `/reactions-service/${areaType}/bookmarked/search`,
        data: {
            offset: options.offset,
            limit,
            withMedia: options.withMedia,
            withUser: options.withUser,
            blockedUsers: options.blockedUsers || [],
            shouldHideMatureContent: !!options.shouldHideMatureContent,
        },
    });

    // Moments
    createOrUpdateMomentReaction = (id: number, data: ICreateOrUpdateAreaReactionBody) => this.createOrUpdatePostReaction(
        'moments',
        id,
        data,
    );

    getMomentReactions = (queryParams: IGetMomentReactionParams) => {
        let queryString = `?limit=${queryParams.limit || 100}`;

        if (queryParams.momentId) {
            queryString = `${queryString}&momentId=${queryParams.momentId}`;
        }

        if (queryParams.momentIds) {
            queryString = `${queryString}&momentIds=${queryParams.momentIds.join(',')}`;
        }

        return axios({
            method: 'get',
            url: `/reactions-service/moment-reactions${queryString}`,
        });
    };

    findMomentReactions = (params: IFindMomentReactionParams) => axios({
        method: 'post',
        url: '/reactions-service/moment-reactions/find/dynamic',
        data: params,
    });

    getReactionsByMomentId = (id: number, limit: number) => {
        const queryString = `?limit=${limit || 100}`;

        return axios({
            method: 'get',
            url: `/reactions-service/moment-reactions/${id}${queryString}`,
        });
    };

    searchActiveMoments = (options: ISearchActiveAreasParams, limit = 21) => this.searchActivePosts('moments', options, limit);

    searchActiveMomentsByIds = (options: ISearchActiveAreasByIdsParams, ids: string[]) => this
        .searchActivePostsByIds('moments', options, ids);

    searchBookmarkedMoments = (options: ISearchBookmarkedAreasParams, limit = 21) => this.searchBookmarkedAreas(
        'moments',
        options,
        limit,
    );

    // Spaces
    createOrUpdateSpaceReaction = (id: number, data: ICreateOrUpdateSpaceReactionBody) => this.createOrUpdatePostReaction(
        'spaces',
        id,
        data,
    );

    getSpaceReactions = (queryParams: IGetSpaceReactionParams) => {
        let queryString = `?limit=${queryParams.limit || 100}`;

        if (queryParams.spaceId) {
            queryString = `${queryString}&spaceId=${queryParams.spaceId}`;
        }

        if (queryParams.spaceIds) {
            queryString = `${queryString}&spaceIds=${queryParams.spaceIds.join(',')}`;
        }

        return axios({
            method: 'get',
            url: `/reactions-service/space-reactions${queryString}`,
        });
    };

    getSpaceRatings = (spaceId: string) => axios({
        method: 'get',
        url: `/reactions-service/space-reactions/${spaceId}/ratings`,
    });

    findSpaceReactions = (params: IFindSpaceReactionParams) => axios({
        method: 'post',
        url: '/reactions-service/space-reactions/find/dynamic',
        data: params,
    });

    getReactionsBySpaceId = (id: number, limit: number) => {
        const queryString = `?limit=${limit || 100}`;

        return axios({
            method: 'get',
            url: `/reactions-service/space-reactions/${id}${queryString}`,
        });
    };

    searchActiveSpaces = (options: ISearchActiveAreasParams, limit = 21) => this.searchActivePosts('spaces', options, limit);

    searchActiveSpacesByIds = (options: ISearchActiveAreasByIdsParams, ids: string[]) => this
        .searchActivePostsByIds('spaces', options, ids);

    searchBookmarkedSpaces = (options: ISearchBookmarkedAreasParams, limit = 21) => this.searchBookmarkedAreas(
        'spaces',
        options,
        limit,
    );

    // Thoughts
    createOrUpdateThoughtReaction = (id: number, data: ICreateOrUpdateAreaReactionBody) => this.createOrUpdatePostReaction(
        'thoughts',
        id,
        data,
    );

    getThoughtReactions = (queryParams: IGetThoughtReactionParams) => {
        let queryString = `?limit=${queryParams.limit || 100}`;

        if (queryParams.thoughtId) {
            queryString = `${queryString}&thoughtId=${queryParams.thoughtId}`;
        }

        if (queryParams.thoughtIds) {
            queryString = `${queryString}&thoughtIds=${queryParams.thoughtIds.join(',')}`;
        }

        return axios({
            method: 'get',
            url: `/reactions-service/thought-reactions${queryString}`,
        });
    };

    findThoughtReactions = (params: IFindThoughtReactionParams) => axios({
        method: 'post',
        url: '/reactions-service/thought-reactions/find/dynamic',
        data: params,
    });

    getReactionsByThoughtId = (id: number, limit: number) => {
        const queryString = `?limit=${limit || 100}`;

        return axios({
            method: 'get',
            url: `/reactions-service/thought-reactions/${id}${queryString}`,
        });
    };

    searchActiveThoughts = (options: ISearchActiveAreasParams, limit = 21) => this.searchActivePosts('thoughts', options, limit);

    searchBookmarkedThoughts = (options: ISearchBookmarkedAreasParams, limit = 21) => axios({
        method: 'post',
        url: '/reactions-service/thoughts/bookmarked/search',
        data: {
            offset: options.offset,
            limit,
            withUser: options.withUser,
            blockedUsers: options.blockedUsers || [],
            shouldHideMatureContent: !!options.shouldHideMatureContent,
        },
    });
}

export default new ReactionsService();
