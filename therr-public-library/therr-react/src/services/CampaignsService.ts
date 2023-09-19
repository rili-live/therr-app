import axios from 'axios';
import { getSearchQueryString } from 'therr-js-utilities/http';
import { ISearchQuery } from '../types';

class CampaignsService {
    create = (data: any) => axios({
        method: 'post',
        url: '/users-service/campaigns',
        data,
    });

    searchMyCampaigns = (query: ISearchQuery, data: any = {}) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'post',
            url: `/users-service/campaigns/search/me${queryString}`,
            data,
        });
    };
}

export default new CampaignsService();
