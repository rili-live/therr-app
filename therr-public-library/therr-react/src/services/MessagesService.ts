/* eslint-disable class-methods-use-this */
import axios from 'axios';
import { ILogLevel } from 'therr-js-utilities/constants';
import { getSearchQueryString } from 'therr-js-utilities/http';
import { ISearchQuery } from '../types';

class MessagesService {
    sendAppLog = (data: { [key: string]: string }, logLevel?: ILogLevel) => {
        const url = `/messages-service/app-logs?logLevel=${logLevel || 'info'}`;

        return axios({
            method: 'post',
            url,
            data,
        }).catch((err) => console.log(`Failed to send app log likely due to bad connection: ${err.message}`));
    };

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

    searchMyDMs = (query: ISearchQuery) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'get',
            url: `/messages-service/direct-messages/me${queryString}`,
        });
    };

    searchForumMessages = (forumId: string, query: ISearchQuery) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'get',
            url: `/messages-service/forums-messages/${forumId}${queryString}`,
        });
    };
}

export default new MessagesService();
