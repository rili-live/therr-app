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

class MessagesService {
    createForum = (data: ICreateForumBody) => axios({
        method: 'post',
        url: '/messages-service/forums',
        data,
    })

    searchDMs = (query: ISearchQuery) => {
        let queryString = getSearchQueryString(query);

        if (query.shouldCheckReverse) {
            queryString = `${queryString}&shouldCheckReverse=true`;
        }

        return axios({
            method: 'get',
            url: `/messages-service/direct-messages${queryString}`,
        });
    }

    searchForumMessages = (query: ISearchQuery) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'get',
            url: `/messages-service/forum-messages${queryString}`,
        });
    }
}

export default new MessagesService();
