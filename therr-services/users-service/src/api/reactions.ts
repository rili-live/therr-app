import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import * as globalConfig from '../../../../global-config';

const baseReactionsServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseReactionsServiceRoute;

const getReactions = (thoughtId: string, headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'get',
    url: `${baseReactionsServiceRoute}/thought-reactions/${thoughtId}`,
});

/**
 * The requesting user's own reactions for a batch of thoughts, keyed by thoughtId.
 * Used to render each reply's like/bookmark control in its already-toggled state.
 */
const findReactionsByUser = (thoughtIds: string[], headers: InternalConfigHeaders) => {
    if (!thoughtIds?.length) {
        return Promise.resolve({});
    }

    return internalRestRequest({
        headers,
    }, {
        method: 'post',
        url: `${baseReactionsServiceRoute}/thought-reactions/find/dynamic`,
        data: {
            thoughtIds,
            // `find/dynamic` defaults to 100 rows ordered by `createdAt DESC`. Replies on a
            // thought are not capped, and opening a thread activates every reply (one reaction
            // row each), so leaving the default in place silently drops the like state of
            // every reply past the 100th on a busy thread. There is at most one reaction row
            // per (user, thought), so the batch size is the exact bound.
            limit: thoughtIds.length,
        },
    })
        .then(({ data }) => (data?.reactions || []).reduce((acc: any, reaction: any) => ({
            ...acc,
            [reaction.thoughtId]: reaction,
        }), {}))
        .catch(() => ({}));
};

const countReactions = (thoughtId: string, headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'get',
    url: `${baseReactionsServiceRoute}/thought-reactions/${thoughtId}/count`,
})
    .then(({ data: countResult }) => countResult);

/**
 * Like counts for a batch of thoughts, keyed by thoughtId. Missing keys mean zero likes.
 * A failure here degrades to "no counts" rather than failing the whole details view.
 */
const countReactionsByThoughtId = (thoughtIds: string[], headers: InternalConfigHeaders) => {
    if (!thoughtIds?.length) {
        return Promise.resolve({});
    }

    return internalRestRequest({
        headers,
    }, {
        method: 'post',
        url: `${baseReactionsServiceRoute}/thought-reactions/count/multiple`,
        data: {
            thoughtIds,
        },
    })
        .then(({ data }) => data?.counts || {})
        .catch(() => ({}));
};

const hasUserReacted = (thoughtId: string, headers) => getReactions(thoughtId, headers)
    .then(({ data: thoughtReaction }) => !!(thoughtReaction && thoughtReaction.userHasActivated))
    .catch((err) => {
        if (err?.response?.data?.statusCode === 403) {
            return false;
        }
        throw err;
    });

interface IRelevanceScoresByThoughtId {
    [thoughtId: string]: number;
}

// `relevanceScores` is optional: callers that activate thoughts without ranking them
// (e.g. activating a thought's replies alongside their parent) simply omit it, and those
// rows keep a NULL relevanceScore.
const createReactions = (
    thoughtIds: string[],
    headers: InternalConfigHeaders,
    relevanceScores?: IRelevanceScoresByThoughtId,
    algorithmKey?: string,
) => internalRestRequest({
    headers,
}, {
    method: 'post',
    url: `${baseReactionsServiceRoute}/thought-reactions/create-update/multiple`,
    data: {
        thoughtIds,
        userHasActivated: true,
        ...(relevanceScores ? { relevanceScores } : {}),
        // Unlike relevanceScores this is per-run, not per-thought, so it rides along in the
        // shared param set the receiving handler spreads into every inserted/updated row.
        // Records which profile produced the scores, so a row's score can be interpreted (and
        // a future read-time blend can tell whether it needs re-scoring).
        ...(algorithmKey ? { algorithmKey } : {}),
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

/**
 * Clears the user's stored relevance scores so their stream re-ranks under a newly-selected
 * algorithm. The target user comes from the `x-userid` header the internal client already
 * sends, so this only ever resets the acting user's own stream.
 */
const resetThoughtRelevance = (headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'post',
    url: `${baseReactionsServiceRoute}/thought-reactions/relevance/reset`,
    data: {},
});

export {
    createReactions,
    resetThoughtRelevance,
    findReactionsByUser,
    countReactions,
    countReactionsByThoughtId,
    getReactions,
    hasUserReacted,
};
