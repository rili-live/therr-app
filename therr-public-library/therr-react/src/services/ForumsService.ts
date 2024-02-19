/* eslint-disable class-methods-use-this */
import axios from 'axios';
import { getSearchQueryString } from 'therr-js-utilities/http';
import { ISearchQuery } from '../types';

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
}

export interface ISearchForumsArgs {
    categoryTags?: number[];
    forumIds?: number[];
    usersInvitedForumIds?: number[];
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

    searchCategories = (query: ISearchQuery) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'get',
            url: `/messages-service/forums/categories${queryString}`,
        });
    };

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
