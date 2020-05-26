import axios from 'axios';
import { getSearchQueryString } from 'rili-public-library/utilities/http';
import { ISearchQuery } from '../types';

class NotificationsService {
    search = (query: ISearchQuery) => {
        const queryString = getSearchQueryString(query);
        return axios({
            method: 'get',
            url: `/users/notifications${queryString}`,
        });
    }
}

export default new NotificationsService();
