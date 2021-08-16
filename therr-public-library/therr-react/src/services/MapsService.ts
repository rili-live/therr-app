import axios from 'axios';
import { getSearchQueryString } from 'therr-js-utilities/http';
import { ISearchQuery } from '../types';

interface ISearchMomentsArgs {
    distanceOverride?: number;
}

interface IGetMomentDetailsArgs {
    withMedia?: boolean;
    withUser?: boolean;
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

export interface IPlacesAutoCompleteArgs {
    longitude: string;
    latitude: string;
    radius?: number | string;
    apiKey: string,
    input: string;
}

export interface IPlaceDetailsArgs {
    apiKey: string;
    placeId: string;
}

class MapsService {
    createMoment = (data: ICreateMomentBody) => axios({
        method: 'post',
        url: '/maps-service/moments',
        data,
    })

    getMomentDetails = (momentId: number, args: IGetMomentDetailsArgs) => axios({
        method: 'post',
        url: `/maps-service/moments/${momentId}/details`,
        data: args,
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

    // Google Maps
    // TODO: Use sessiontoken to prevent being over-billed
    getPlacesSearchAutoComplete = ({
        longitude,
        latitude,
        radius,
        apiKey,
        input,
    }: IPlacesAutoCompleteArgs) => {
        let url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json?';

        url = `${url}input=${input}&location=${latitude},${longitude}`;

        if (radius) {
            url = `${url}&radius=${radius}`;
        }

        url = `${url}&key=${apiKey}`;

        return axios({
            method: 'get',
            url,
            headers: {},
        });
    }

    getPlaceDetails = ({
        apiKey,
        placeId,
    }: IPlaceDetailsArgs) => {
        let url = 'https://maps.googleapis.com/maps/api/place/details/json?fields=geometry&';

        url = `${url}place_id=${placeId}&key=${apiKey}`;

        return axios({
            method: 'get',
            url,
            headers: {},
        });
    }
}

export default new MapsService();
