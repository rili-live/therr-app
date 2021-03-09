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

export interface IUpdateMomentReactionBody {
    userViewCount?: number;
    userHasActivated?: boolean;
    userHasLiked?: boolean;
    userHasSuperLiked?: boolean;
    userHasDisliked?: boolean;
    userHasSuperDisliked?: boolean;
}

class ReactionsService {
    createMomentReaction = (data: ICreateMomentReactionBody) => axios({
        method: 'post',
        url: '/reactions-service/moment-reactions',
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

    updateMomentReactions = (momentId: number, data: IUpdateMomentReactionBody) => axios({
        method: 'put',
        url: `/reactions-service/moment-reactions/${momentId}`,
        data,
    })
}

export default new ReactionsService();
