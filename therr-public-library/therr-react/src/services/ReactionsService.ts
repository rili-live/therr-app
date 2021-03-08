import axios from 'axios';

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
    createMomentReaction = (data: ICreateMomentBody) => axios({
        method: 'post',
        url: '/reactions-service/moment-reactions',
        data,
    })

    getMomentReactions = (queryParams: any) => {
        let queryString = `?limit=${queryParams.limit || 100}`;

        if (queryParams.momentId) {
            queryString = `${queryString}&momentId=${queryParams.momentId}`;
        }

        if (queryParams.momentIds) {
            queryString = `${queryString}&momentIds=${queryParams.momentIds}`;
        }

        return axios({
            method: 'get',
            url: `/reactions-service/moment-reactions${queryString}`,
        });
    }

    getReactionsByMomentId = (momentId: number, limit: number) => {
        const queryString = `?limit=${limit || 100}`;

        return axios({
            method: 'get',
            url: `/reactions-service/moment-reactions/${momentId}${queryString}`,
        });
    }

    updateMoments = (momentId: number, data: IDeleteMomentsBody) => axios({
        method: 'put',
        url: `/reactions-service/moment-reactions/${momentId}`,
        data,
    })
}

export default new MapsService();
