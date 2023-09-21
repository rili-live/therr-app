/* eslint-disable class-methods-use-this */
import axios from 'axios';
import { getSearchQueryString } from 'therr-js-utilities/http';
import { ISearchQuery } from '../types';

class NotificationsService {
    search = (query: ISearchQuery) => {
        const queryString = getSearchQueryString(query);
        return axios({
            method: 'get',
            url: `/users-service/users/notifications${queryString}`,
        });
    };
}

export default new NotificationsService();
