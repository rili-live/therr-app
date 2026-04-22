import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import * as globalConfig from '../../../../global-config';

const baseReactionsServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseReactionsServiceRoute;

export default (areaType: 'moment' | 'space' | 'event', areaId: string, headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'get',
    url: `${baseReactionsServiceRoute}/${areaType}-reactions/${areaId}`,
})
    .then(({ data: areaReaction }) => {
        if (areaReaction && areaReaction.userHasActivated) {
            return areaReaction;
        }
        return false;
    })
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

// Batch ratings: single request to reactions-service instead of N+1
export const getBatchRatings = (areaType: 'space' | 'event', areaIds: string[], headers: InternalConfigHeaders) => {
    if (!areaIds?.length) {
        return Promise.resolve({});
    }

    const idsKey = areaType === 'space' ? 'spaceIds' : 'eventIds';

    return internalRestRequest({
        headers,
    }, {
        method: 'post',
        url: `${baseReactionsServiceRoute}/${areaType}-reactions/ratings/batch`,
        data: { [idsKey]: areaIds },
    })
        .then(({ data: ratingsMap }) => ratingsMap)
        .catch((err) => {
            console.log(`getBatchRatings error for ${areaType}:`, err?.message);
            return {};
        });
};

// Converts batch ratings map to ordered array matching input areaIds
export const getRatings = (areaType: 'space' | 'event', areaIds: string[], headers: InternalConfigHeaders) => getBatchRatings(areaType, areaIds, headers)
    .then((ratingsMap) => areaIds.map((id) => ratingsMap[id] || { avgRating: null, totalRatings: 0 }));
