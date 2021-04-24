import axios from 'axios';

export interface ICreateMomentReactionBody {
    momentId: number;
    userId: number;
    userViewCount?: number;
    userHasActivated?: boolean;
    userHasLiked?: boolean;
    userHasSuperLiked?: boolean;
    userHasDisliked?: boolean;
    userHasSuperDisliked?: boolean;
}
export interface IGetMomentReactionParams {
    limit?: number;
    momentId?: number;
    momentIds?: number[];
}

export interface ICreateOrUpdateMomentReactionBody {
    userViewCount?: number;
    userHasActivated?: boolean;
    userHasLiked?: boolean;
    userHasSuperLiked?: boolean;
    userHasDisliked?: boolean;
    userHasSuperDisliked?: boolean;
}

class ReactionsService {
    createOrUpdateMomentReactions = (momentId: number, data: ICreateOrUpdateMomentReactionBody) => axios({
        method: 'post',
        url: `/reactions-service/moment-reactions/${momentId}`,
        data,
    })

    getMomentReactions = (queryParams: IGetMomentReactionParams) => {
        let queryString = `?limit=${queryParams.limit || 100}`;

        if (queryParams.momentId) {
            queryString = `${queryString}&momentId=${queryParams.momentId}`;
        }

        if (queryParams.momentIds) {
            queryString = `${queryString}&momentIds=${queryParams.momentIds.join(',')}`;
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

    searchActiveMoments = (offset: number, limit = 21) => axios({
        method: 'post',
        url: '/reactions-service/moments/active/search',
        data: {
            offset,
            limit,
        },
    });
}

export default new ReactionsService();
