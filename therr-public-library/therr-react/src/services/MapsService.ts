import axios from 'axios';
import { getSearchQueryString } from 'therr-js-utilities/http';
import { ISearchQuery } from '../types';

interface ICreateMomentBody {
    expiresAt?: any;
    fromUserId: number;
    locale: string;
    isPublic?: boolean;
    message: string;
    notificationMsg?: string;
    mediaIds?: string;
    mentionsIds?: string;
    hashTags?: string;
    maxViews?: number;
    latitude: string;
    longitude: string;
    radius?: string;
    polygonCoords?: string;
}

class MapsService {
    createMoment = (data: ICreateMomentBody) => axios({
        method: 'post',
        url: '/maps-service/moments',
        data,
    })

    searchMoments = (query: ISearchQuery) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'get',
            url: `/maps-service/moments${queryString}`,
        });
    }
}

export default new MapsService();
