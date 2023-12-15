/* eslint-disable class-methods-use-this */
import axios from 'axios';
import { getSearchQueryString } from 'therr-js-utilities/http';
import { ISearchQuery } from '../types';

class CampaignsService {
    create = (data: any) => axios({
        method: 'post',
        url: '/users-service/campaigns',
        data,
    });

    get = (id: any) => axios({
        method: 'get',
        url: `/users-service/campaigns/${id}`,
    });

    searchMyCampaigns = (query: ISearchQuery, data: any = {}) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'post',
            url: `/users-service/campaigns/search/me${queryString}`,
            data,
        });
    };

    searchAllCampaigns = (query: ISearchQuery, data: any = {}) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'post',
            url: `/users-service/campaigns/search/all${queryString}`,
            data,
        });
    };

    update = (id: any, data: any) => axios({
        method: 'put',
        url: `/users-service/campaigns/${id}`,
        data,
    });
}

export default new CampaignsService();
