import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import * as globalConfig from '../../../../global-config';

const baseReactionsServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseReactionsServiceRoute;

export default (areaType: 'moment' | 'space' | 'event', areaId: string, headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'get',
    url: `${baseReactionsServiceRoute}/${areaType}-reactions/${areaId}`,
})
    .then(({ data: areaReaction }) => !!(areaReaction && areaReaction.userHasActivated))
    .catch((err) => {
        if (err?.response?.data?.statusCode === 403) {
            return false;
        }
        throw err;
    });

export const countReactions = (areaType: 'moment' | 'space' | 'event', areaId: string, headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'get',
    url: `${baseReactionsServiceRoute}/${areaType}-reactions/${areaId}/count`,
})
    .then(({ data: countResult }) => countResult);

export const getRating = (areaType: 'space' | 'event', areaId: string, headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'get',
    url: `${baseReactionsServiceRoute}/${areaType}-reactions/${areaId}/ratings`,
})
    .then(({ data: rating }) => rating)
    .catch((err) => {
        if (err?.response?.data?.statusCode === 403) {
            return false;
        }
        throw err;
    });

// TODO: This would be more performance as a single request to reactions-service
export const getRatings = (areaType: 'space' | 'event', areaIds: string[], headers: InternalConfigHeaders) => Promise.all(
    areaIds.map((id) => getRating(areaType, id, headers)),
);
