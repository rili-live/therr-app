import axios from 'axios';
import { IAreaType } from '../types';

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
export interface ICreateSpaceReactionBody extends ICreateAreaReactionBody {
    spaceId: number;
}
export interface IGetSpaceReactionParams {
    limit?: number;
    spaceId?: number;
    spaceIds?: number[];
}

class ReactionsService {
    createOrUpdateAreaReaction = (areaType: IAreaType, id: number, data: ICreateOrUpdateAreaReactionBody) => {
        const typeSingular = areaType === 'moments' ? 'moment' : 'space';

        return axios({
            method: 'post',
            url: `/reactions-service/${typeSingular}-reactions/${id}`,
            data,
        });
    }

    searchActiveAreas = (areaType: IAreaType, options: ISearchActiveAreasParams, limit = 21) => axios({
        method: 'post',
        url: `/reactions-service/${areaType}/active/search`,
        data: {
            offset: options.offset,
            limit,
            order: options.order,
            blockedUsers: options.blockedUsers || [],
            shouldHideMatureContent: !!options.shouldHideMatureContent,
            withMedia: options.withMedia,
            withUser: options.withUser,
            userLatitude: options.userLatitude,
            userLongitude: options.userLongitude,
        },
    })

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
    })

    // Moments
    createOrUpdateMomentReaction = (id: number, data: ICreateOrUpdateAreaReactionBody) => this.createOrUpdateAreaReaction(
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
    }

    getReactionsByMomentId = (id: number, limit: number) => {
        const queryString = `?limit=${limit || 100}`;

        return axios({
            method: 'get',
            url: `/reactions-service/moment-reactions/${id}${queryString}`,
        });
    }

    searchActiveMoments = (options: ISearchActiveAreasParams, limit = 21) => this.searchActiveAreas('moments', options, limit);

    searchBookmarkedMoments = (options: ISearchBookmarkedAreasParams, limit = 21) => this.searchBookmarkedAreas(
        'moments',
        options,
        limit,
    );

    // Spaces
    createOrUpdateSpaceReaction = (id: number, data: ICreateOrUpdateAreaReactionBody) => this.createOrUpdateAreaReaction(
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
    }

    getReactionsBySpaceId = (id: number, limit: number) => {
        const queryString = `?limit=${limit || 100}`;

        return axios({
            method: 'get',
            url: `/reactions-service/space-reactions/${id}${queryString}`,
        });
    }

    searchActiveSpaces = (options: ISearchActiveAreasParams, limit = 21) => this.searchActiveAreas('spaces', options, limit);

    searchBookmarkedSpaces = (options: ISearchBookmarkedAreasParams, limit = 21) => this.searchBookmarkedAreas(
        'spaces',
        options,
        limit,
    );
}

export default new ReactionsService();
