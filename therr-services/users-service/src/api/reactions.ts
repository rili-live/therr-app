import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import * as globalConfig from '../../../../global-config';

const baseReactionsServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseReactionsServiceRoute;

const getReactions = (thoughtId: string, headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'get',
    url: `${baseReactionsServiceRoute}/thought-reactions/${thoughtId}`,
});

const findReactions = (thoughtId: string, headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'post',
    url: `${baseReactionsServiceRoute}/thought-reactions/find/dynamic`,
    data: {
        thoughtIds: [thoughtId],
    },
});

const countReactions = (thoughtId: string, headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'get',
    url: `${baseReactionsServiceRoute}/thought-reactions/${thoughtId}/count`,
})
    .then(({ data: countResult }) => countResult);

const hasUserReacted = (thoughtId: string, headers) => getReactions(thoughtId, headers)
    .then(({ data: thoughtReaction }) => !!(thoughtReaction && thoughtReaction.userHasActivated))
    .catch((err) => {
        if (err?.response?.data?.statusCode === 403) {
            return false;
        }
        throw err;
    });

const createReactions = (thoughtIds: string[], headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'post',
    url: `${baseReactionsServiceRoute}/thought-reactions/create-update/multiple`,
    data: {
        thoughtIds,
        userHasActivated: true,
    },
})
    // eslint-disable-next-line arrow-body-style
    .then(({ data: { created, updated } }) => {
        // console.log(created, updated);
        return {
            created,
            updated,
        };
    })
    .catch((err) => {
        if (err?.response?.data?.statusCode === 403) {
            return {
                error: 'unauthorized',
            };
        }
        throw err;
    });

export {
    createReactions,
    findReactions,
    countReactions,
    getReactions,
    hasUserReacted,
};
