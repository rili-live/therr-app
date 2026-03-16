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

    update = (id: string, data: any) => axios({
        method: 'put',
        url: `/users-service/users/notifications/${id}`,
        data,
    });
}

export default new NotificationsService();
