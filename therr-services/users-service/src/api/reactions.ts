import axios from 'axios';
import * as globalConfig from '../../../../global-config';

const baseReactionsServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseReactionsServiceRoute;

const getReactions = (thoughtId: string, headers) => axios({
    method: 'get',
    url: `${baseReactionsServiceRoute}/thought-reactions/${thoughtId}`,
    headers,
});

const findReactions = (thoughtId: string, headers) => axios({
    method: 'post',
    url: `${baseReactionsServiceRoute}/thought-reactions/find/dynamic`,
    headers,
    data: {
        thoughtIds: [thoughtId],
    },
});

const countReactions = (thoughtId: string, headers) => axios({
    method: 'get',
    url: `${baseReactionsServiceRoute}/thought-reactions/${thoughtId}/count`,
    headers,
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

const createReactions = (thoughtIds: string[], headers) => axios({
    method: 'post',
    url: `${baseReactionsServiceRoute}/thought-reactions/create-update/multiple`,
    headers,
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
