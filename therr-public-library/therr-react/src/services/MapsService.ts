import axios from 'axios';
import { getSearchQueryString } from 'therr-js-utilities/http';
import { ISearchQuery } from '../types';

interface ISearchMomentsArgs {
    distanceOverride?: number;
}
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

interface IDeleteMomentsBody {
    ids: string[];
}

class MapsService {
    createMoment = (data: ICreateMomentBody) => axios({
        method: 'post',
        url: '/maps-service/moments',
        data,
    })

    searchMoments = (query: ISearchQuery, data: ISearchMomentsArgs = {}) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'post',
            url: `/maps-service/moments/search${queryString}`,
            data,
        });
    }

    getSignedUrlPublicBucket = (args) => {
        const queryString = `?action=${args.action}&filename=${args.filename}`;

        return axios({
            method: 'get',
            url: `/maps-service/moments/signed-url/public${queryString}`,
        });
    }

    getSignedUrlPrivateBucket = (args) => {
        const queryString = `?action=${args.action}&filename=${args.filename}`;

        return axios({
            method: 'get',
            url: `/maps-service/moments/signed-url/private${queryString}`,
        });
    }

    deleteMoments = (data: IDeleteMomentsBody) => axios({
        method: 'delete',
        url: '/maps-service/moments',
        data,
    })
}

export default new MapsService();
