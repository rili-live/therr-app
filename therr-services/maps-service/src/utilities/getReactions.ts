import axios from 'axios';
import * as globalConfig from '../../../../global-config';

const baseReactionsServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseReactionsServiceRoute;

export default (areaType: 'moment' | 'space' | 'event', areaId: string, headers) => axios({
    method: 'get',
    url: `${baseReactionsServiceRoute}/${areaType}-reactions/${areaId}`,
    headers,
})
    .then(({ data: areaReaction }) => !!(areaReaction && areaReaction.userHasActivated))
    .catch((err) => {
        if (err?.response?.data?.statusCode === 403) {
            return false;
        }
        throw err;
    });

export const countReactions = (areaType: 'moment' | 'space' | 'event', areaId: string, headers) => axios({
    method: 'get',
    url: `${baseReactionsServiceRoute}/${areaType}-reactions/${areaId}/count`,
    headers,
})
    .then(({ data: countResult }) => countResult);

export const getRating = (areaType: 'space' | 'event', areaId: string, headers?) => axios({
    method: 'get',
    url: `${baseReactionsServiceRoute}/${areaType}-reactions/${areaId}/ratings`,
    headers,
})
    .then(({ data: rating }) => rating)
    .catch((err) => {
        if (err?.response?.data?.statusCode === 403) {
            return false;
        }
        throw err;
    });

// TODO: This would be more performance as a single request to reactions-service
export const getRatings = (areaType: 'space' | 'event', areaIds: string[], headers?) => Promise.all(
    areaIds.map((id) => getRating(areaType, id, headers)),
);
