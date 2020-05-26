import axios from 'axios';
import { getSearchQueryString } from 'rili-public-library/utilities/http';
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

    update = (requestingUserId: string | number, data: ICreateConnectionBody) => axios({
        method: 'put',
        url: `/users/connections/${requestingUserId}`,
        data,
    })

    search = (query: ISearchQuery) => {
        let queryString = getSearchQueryString(query);
        if (query.shouldCheckReverse) {
            queryString = `${queryString}&shouldCheckReverse=true`;
        }
        return axios({
            method: 'get',
            url: `/users/connections${queryString}`,
        });
    }
}

export default new UserConnectionsService();
