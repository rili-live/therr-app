/* eslint-disable class-methods-use-this */
import axios from 'axios';
import { getSearchQueryString } from 'therr-js-utilities/http';
import { ISearchQuery } from '../types';

class MessagesService {
    searchDMs = (query: ISearchQuery) => {
        let queryString = getSearchQueryString(query);

        if (query.shouldCheckReverse) {
            queryString = `${queryString}&shouldCheckReverse=true`;
        }

        return axios({
            method: 'get',
            url: `/messages-service/direct-messages${queryString}`,
        });
    };

    searchForumMessages = (query: ISearchQuery) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'get',
            url: `/messages-service/forum-messages${queryString}`,
        });
    };
}

export default new MessagesService();
