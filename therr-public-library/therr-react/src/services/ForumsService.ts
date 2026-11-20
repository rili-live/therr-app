/* eslint-disable class-methods-use-this */
import axios from 'axios';
import { getSearchQueryString } from 'therr-js-utilities/http';
import { ISearchQuery } from '../types';
import { ICreateEventBody } from './MapsService';

export interface ICreateForumBody {
    administratorIds: number;
    title: string;
    subtitle: string;
    description: string;
    categoryTags: string[];
    hashtags: string;
    integrationIds: number[];
    invitees: number[];
    iconGroup: string;
    iconId: string;
    iconColor: string;
    maxCommentsPerMin?: number;
    doesExpire?: boolean;
    isPublic?: boolean;
    city?: string;
    region?: string;
    country?: string;
    localLatitude?: number;
    localLongitude?: number;
}

export interface ICreateActivityBody {
    group: ICreateForumBody;
    event: ICreateEventBody;
}

export interface ISearchForumsArgs {
    categoryTags?: number[];
    forumIds?: number[];
    usersInvitedForumIds?: number[];
    nearbyCity?: string;
    nearbyLatitude?: number;
    nearbyLongitude?: number;
    nearbyMaxDistanceKm?: number;
}

export type ForumReportReason = 'spam' | 'scam' | 'offensive' | 'other';

export interface IReportForumBody {
    reason?: ForumReportReason;
}

class ForumsService {
    getForum = (forumId: string) => axios({
        method: 'get',
        url: `/messages-service/forums/${forumId}`,
    });

    createForum = (data: ICreateForumBody) => axios({
        method: 'post',
        url: '/messages-service/forums',
        data,
    });

    createActivity = (data: ICreateActivityBody) => axios({
        method: 'post',
        url: '/messages-service/forums/activities',
        data,
    });

    updateForum = (id: string, data: ICreateForumBody) => axios({
        method: 'put',
        url: `/messages-service/forums/${id}`,
        data,
    });

    archiveForum = (id: string) => axios({
        method: 'delete',
        url: `/messages-service/forums/${id}`,
    });

    searchCategories = (query: ISearchQuery) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'get',
            url: `/messages-service/forums/categories${queryString}`,
        });
    };

    /** Moves the caller's unread watermark for this group to now. */
    markForumRead = (id: string) => axios({
        method: 'put',
        url: `/messages-service/forums/${id}/read`,
    });

    reportForum = (id: string, data: IReportForumBody = {}) => axios({
        method: 'post',
        url: `/messages-service/forums/${id}/report`,
        data,
    });

    searchForums = (query: ISearchQuery, data: ISearchForumsArgs = {}) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'post',
            url: `/messages-service/forums/search${queryString}`,
            data,
        });
    };
}

export default new ForumsService();
