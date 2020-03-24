import axios from 'axios';
import { getSearchQueryString } from 'rili-public-library/utilities/http.js';
import { ISearchQuery } from '../types';

interface ICreateConnectionBody {
    requestingUserId: number;
    acceptingUserEmail?: string;
    acceptingUserPhoneNumber?: string;
}

class UserConnectionsService {
    create = (data: ICreateConnectionBody) => axios({
        method: 'post',
        url: '/users/connections',
        data,
    })

    search = (query: ISearchQuery) => {
        const queryString = getSearchQueryString(query);
        return axios({
            method: 'get',
            url: `/users/connections${queryString}`,
        });
    }
}

export default new UserConnectionsService();
