import axios from 'axios';
import { getSearchQueryString } from 'rili-public-library/utilities/http.js';
import { ISearchQuery } from '../redux/types';

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
