/* eslint-disable class-methods-use-this */
import axios from 'axios';
import uuid from 'react-native-uuid';
import { getSearchQueryString } from 'therr-js-utilities/http';
import { IAreaType } from 'therr-js-utilities/types';
import { ISearchQuery } from '../types';

let googleDynamicSessionToken = uuid.v4(); // This gets stored in the local state of this file/module

export interface ISearchAreasArgs {
    distanceOverride?: number;
    userLatitude?: number;
    userLongitude?: number;
}

interface IGetAreaDetailsArgs {
    withEvents?: boolean;
    withMedia?: boolean;
    withUser?: boolean;
    withRatings?: boolean;
}

export interface ICreateSpaceCheckInMetricsArgs {
    spaceId: string;
    latitude: number;
    longitude: number;
}

export interface IGetSpaceEngagementArgs {
    startDate: string;
    endDate: string;
}

export interface IGetSpaceMetricsArgs {
    startDate: string;
    endDate: string;
}

interface ICreateAreaBody {
    category?: string;
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
    maxProximity?: number;
    latitude: string;
    longitude: string;
    radius?: string;
    polygonCoords?: string;
}

interface ICreateEventBody extends ICreateAreaBody {
    groupId?: string;
    spaceId?: string;
    isDraft?: boolean;
    nearbySpacesSnapshot?: {
        id: string;
        title: string
    }[]
    scheduleStartAt: Date;
    scheduleStopAt: Date;
}

interface ICreateMomentBody extends ICreateAreaBody {
    spaceId?: string;
    isDraft?: boolean;
    nearbySpacesSnapshot?: {
        id: string;
        title: string
    }[]
}

interface ICreateSpaceBody extends ICreateAreaBody {
    addressReadable?: string;
    featuredIncentiveKey?: string;
    featuredIncentiveValue?: number;
    featuredIncentiveRewardKey?: string;
    featuredIncentiveRewardValue?: number;
    featuredIncentiveCurrencyId?: string;
    phoneNumber?: string;
    websiteUrl?: string;
    menuUrl?: string;
    orderUrl?: string;
    reservationUrl?: string;
    businessTransactionId?: string;
    businessTransactionName?: string;
    isPointOfInterest?: boolean;
}

interface IDeleteAreasBody {
    ids: string[];
}

export interface IPlacesAutoCompleteArgs {
    longitude: string;
    latitude: string;
    radius?: number | string;
    types?: string;
    apiKey: string;
    input: string;
    sessiontoken?: string;
}

export interface IPlaceDetailsArgs {
    placeId: string;
    sessiontoken?: string;
    fieldsGroup?: 'basic'|'contact'|'atmosphere';
    shouldIncludeWebsite?: boolean;
    shouldIncludeIntlPhone?: boolean;
    shouldIncludeOpeningHours?: boolean;
    shouldIncludeRating?: boolean;
}

export interface ISignedUrlArgs {
    action: string;
    filename: string;
    areaType?: IAreaType;
    overrideFromUserId?: string;
}

class MapsService {
    fetchMedia = (mediaIds, medias?: { path: string; type: string; }[]) => axios({
        method: 'post',
        url: '/maps-service/media/signed-urls',
        data: {
            mediaIds,
            medias,
        },
    });

    createArea = (areaType: IAreaType, data: ICreateAreaBody) => axios({
        method: 'post',
        url: `/maps-service/${areaType}`,
        data,
    });

    updateArea = (areaType: IAreaType, id: string, data: ICreateMomentBody) => axios({
        method: 'put',
        url: `/maps-service/${areaType}/${id}`,
        data,
    });

    getAreaDetails = (areaType: IAreaType, id: number, args: IGetAreaDetailsArgs) => axios({
        method: 'post',
        url: `/maps-service/${areaType}/${id}/details`,
        data: args,
    });

    searchAreas = (areaType: IAreaType, query: ISearchQuery, data: ISearchAreasArgs = {}) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'post',
            url: `/maps-service/${areaType}/search${queryString}`,
            data,
        });
    };

    searchMyAreas = (areaType: IAreaType, query: ISearchQuery, data: ISearchAreasArgs = {}) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'post',
            url: `/maps-service/${areaType}/search/me${queryString}`,
            data,
        });
    };

    deleteAreas = (areaType: IAreaType, data: IDeleteAreasBody) => axios({
        method: 'delete',
        url: `/maps-service/${areaType}`,
        data,
    });

    // Events
    createEvent = (data: ICreateEventBody) => this.createArea('events', data);

    updateEvent = (id: string, data: ICreateEventBody) => this.updateArea('events', id, data);

    getEventDetails = (id: number, args: IGetAreaDetailsArgs) => this.getAreaDetails('events', id, args);

    getSpaceEvents = (query: ISearchQuery, spaceIds: string[], withMedia = false) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'post',
            url: `/maps-service/events/search/for-space-ids${queryString}`,
            data: {
                spaceIds,
            },
        });
    };

    searchEvents = (query: ISearchQuery, data: ISearchAreasArgs = {}) => this.searchAreas('events', query, data);

    searchMyEvents = (query: ISearchQuery, data: ISearchAreasArgs = {}) => this.searchMyAreas('events', query, data);

    deleteEvents = (data: IDeleteAreasBody) => this.deleteAreas('events', data);

    // Moments
    createMoment = (data: ICreateAreaBody) => this.createArea('moments', data);

    createIntegratedMoment = (platform: string, accessToken: string, mediaId: string) => axios({
        method: 'post',
        url: '/maps-service/moments/integrated',
        data: {
            accessToken,
            mediaId,
            platform,
        },
    });

    updateMoment = (id: string, data: ICreateMomentBody) => this.updateArea('moments', id, data);

    getMomentDetails = (id: number, args: IGetAreaDetailsArgs) => this.getAreaDetails('moments', id, args);

    getSpaceMoments = (query: ISearchQuery, spaceIds: string[], withUser = false) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'post',
            url: `/maps-service/moments/search/for-space-ids${queryString}`,
            data: {
                spaceIds,
                withUser,
            },
        });
    };

    getIntegratedMoments = (userId: string) => axios({
        method: 'get',
        url: `/maps-service/moments/integrated/${userId}`,
    });

    searchMoments = (query: ISearchQuery, data: ISearchAreasArgs = {}) => this.searchAreas('moments', query, data);

    searchMyMoments = (query: ISearchQuery, data: ISearchAreasArgs = {}) => this.searchMyAreas('moments', query, data);

    deleteMoments = (data: IDeleteAreasBody) => this.deleteAreas('moments', data);

    // Spaces
    createSpace = (data: ICreateSpaceBody) => this.createArea('spaces', data);

    updateSpace = (id: string, data: ICreateAreaBody) => this.updateArea('spaces', id, data);

    getSpaceDetails = (id: number, args: IGetAreaDetailsArgs) => this.getAreaDetails('spaces', id, args);

    listSpaces = (query: ISearchQuery, data: ISearchAreasArgs = {}) => {
        const queryString = getSearchQueryString(query);

        return axios({
            method: 'post',
            url: `/maps-service/spaces/list${queryString}`,
            data,
        });
    };

    searchSpaces = (query: ISearchQuery, data: ISearchAreasArgs = {}) => this.searchAreas('spaces', query, data);

    searchMySpaces = (query: ISearchQuery, data: ISearchAreasArgs = {}) => this.searchMyAreas('spaces', query, data);

    deleteSpaces = (data: IDeleteAreasBody) => this.deleteAreas('spaces', data);

    // Dashboard
    claimSpace = (spaceId: string) => {
        const url = `/maps-service/spaces/request-claim/${spaceId}`;

        return axios({
            method: 'post',
            url,
            data: {},
        });
    };

    requestClaim = (args: any) => {
        const url = '/maps-service/spaces/request-claim';

        return axios({
            method: 'post',
            url,
            data: args,
        });
    };

    approveClaim = (spaceId: string) => {
        const url = `/maps-service/spaces/request-approve/${spaceId}`;

        return axios({
            method: 'post',
            url,
            data: {},
        });
    };

    // Map Metrics
    getSpaceEngagement = (spaceId: string, args: IGetSpaceEngagementArgs) => {
        const url = `/maps-service/space-metrics/${spaceId}/engagement?startDate=${args.startDate}&endDate=${args.endDate}`;

        return axios({
            method: 'get',
            url,
            data: args,
        });
    };

    getSpaceMetrics = (spaceId: string, args: IGetSpaceMetricsArgs) => {
        const url = `/maps-service/space-metrics/${spaceId}?startDate=${args.startDate}&endDate=${args.endDate}`;

        return axios({
            method: 'get',
            url,
            data: args,
        });
    };

    createSpaceCheckInMetrics = (args: ICreateSpaceCheckInMetricsArgs) => axios({
        method: 'post',
        url: '/maps-service/space-metrics/check-in',
        data: args,
    });

    // Media
    getSignedUrlPublicBucket = (args: ISignedUrlArgs) => {
        const areaType: IAreaType = args.areaType || 'moments';
        let queryString = `?action=${args.action}&filename=${args.filename}`;
        if (args.overrideFromUserId) {
            queryString = `${queryString}&overrideFromUserId=${args.overrideFromUserId}`;
        }

        return axios({
            method: 'get',
            url: `/maps-service/${areaType}/signed-url/public${queryString}`,
        });
    };

    getSignedUrlPrivateBucket = (args: ISignedUrlArgs) => {
        const areaType: IAreaType = args.areaType || 'moments';
        let queryString = `?action=${args.action}&filename=${args.filename}`;
        if (args.overrideFromUserId) {
            queryString = `${queryString}&overrideFromUserId=${args.overrideFromUserId}`;
        }

        return axios({
            method: 'get',
            url: `/maps-service/${areaType}/signed-url/private${queryString}`,
        });
    };

    // Google Maps
    // TODO: Use sessiontoken to prevent being over-billed
    getPlacesSearchAutoComplete = ({
        longitude,
        latitude,
        radius,
        types,
        input,
        sessiontoken,
    }: IPlacesAutoCompleteArgs) => {
        let url = '/maps-service/place/autocomplete/json?';

        url = `${url}input=${input}&location=${latitude},${longitude}&locationbias=circle:radius@lat,lng`;

        if (radius) {
            url = `${url}&radius=${radius}`;
        }

        if (types) {
            url = `${url}&types=${types}`;
        }

        url = `${url}&sessiontoken=${sessiontoken || googleDynamicSessionToken}`;

        return axios({
            method: 'get',
            url,
            headers: {},
        });
    };

    getPlaceDetails = ({
        placeId,
        sessiontoken,
        fieldsGroup,
        shouldIncludeWebsite,
        shouldIncludeIntlPhone,
        shouldIncludeOpeningHours,
        shouldIncludeRating,
    }: IPlaceDetailsArgs) => {
        let groupFields = 'geometry';
        switch (fieldsGroup) {
            case 'basic':
                // eslint-disable-next-line max-len
                groupFields = 'address_components,adr_address,business_status,formatted_address,geometry,icon,icon_mask_base_uri,icon_background_color,name,photo,place_id,plus_code,type,url,utc_offset,vicinity,wheelchair_accessible_entrance';
                break;
            case 'contact':
                // eslint-disable-next-line max-len
                groupFields = 'current_opening_hours,formatted_phone_number,international_phone_number,opening_hours,secondary_opening_hours,website';
                break;
            case 'atmosphere':
                // eslint-disable-next-line max-len
                groupFields = 'curbside_pickup,delivery,dine_in,editorial_summary,price_level,rating,reservable,reviews,serves_beer,serves_breakfast,serves_brunch,serves_dinner,serves_lunch,serves_vegetarian_food,serves_wine,takeout,user_ratings_total';
                break;
            default:
                groupFields = 'geometry';
        }
        let url = `/maps-service/place/details/json?place_id=${placeId}&`;

        if (shouldIncludeWebsite) {
            groupFields = `${groupFields},website`;
        }
        if (shouldIncludeIntlPhone) {
            groupFields = `${groupFields},international_phone_number`;
        }
        if (shouldIncludeOpeningHours) {
            groupFields = `${groupFields},opening_hours`;
        }
        if (shouldIncludeRating) {
            groupFields = `${groupFields},rating,user_ratings_total`;
        }

        url = `${url}sessiontoken=${sessiontoken || googleDynamicSessionToken}&fields=${groupFields || 'geometry'}`;

        return axios({
            method: 'get',
            url,
            headers: {},
        }).finally(() => {
            googleDynamicSessionToken = uuid.v4(); // This must be updated after each call to get place details
        });
    };

    getPlaceNearbySearch = ({
        placeId,
        sessiontoken,
    }: IPlaceDetailsArgs) => {
        let url = '/maps-service/place/nearbysearch/json?fields=geometry&';

        url = `${url}place_id=${placeId}&sessiontoken=${sessiontoken || googleDynamicSessionToken}`;

        return axios({
            method: 'get',
            url,
            headers: {},
        }).finally(() => {
            googleDynamicSessionToken = uuid.v4(); // This must be updated after each call to get place details
        });
    };
}

export default new MapsService();
