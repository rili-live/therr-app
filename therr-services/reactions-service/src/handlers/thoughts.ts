import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { parseHeaders } from 'therr-js-utilities/http';
import {
    getContentRankingScore,
    selectAutoExpandedThoughtIds,
} from 'therr-js-utilities/content-ranking';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
// import translate from '../utilities/translator';
import * as globalConfig from '../../../../global-config';

// Cap how many replies per auto-expanded thread are considered for the "top reply" so
// the like-count lookup stays bounded no matter how large a thread grows
const MAX_TOP_REPLY_CANDIDATES_PER_THREAD = 10;

/**
 * Twitter/X-style thread expansion: for the highest-ranked threads on the page, pick the
 * most-liked (tie-break: earliest) visible reply and attach it as `topReply` alongside
 * `shouldAutoExpand`. One additional bounded count query per feed page.
 */
const attachThreadExpansions = async (rankedThoughts: any[], nowMs: number) => {
    const autoExpandIds = new Set(selectAutoExpandedThoughtIds(rankedThoughts, { nowMs }));
    if (!autoExpandIds.size) {
        return rankedThoughts;
    }

    const replyCandidatesByThoughtId: Record<string, any[]> = {};
    const allCandidateReplyIds: string[] = [];
    rankedThoughts.forEach((thought) => {
        if (!autoExpandIds.has(thought.id)) {
            return;
        }
        const candidates = (thought.replies || [])
            .filter((reply) => reply.isPublic && !reply.isMatureContent && reply.message)
            .slice(0, MAX_TOP_REPLY_CANDIDATES_PER_THREAD);
        if (candidates.length) {
            replyCandidatesByThoughtId[thought.id] = candidates;
            candidates.forEach((reply) => allCandidateReplyIds.push(reply.id));
        }
    });

    const replyLikeCounts = await Store.thoughtReactions.getCounts(allCandidateReplyIds, {}, 'userHasLiked')
        .catch(() => []);
    const likeCountByReplyId = replyLikeCounts.reduce((acc, cur) => ({
        ...acc,
        [cur.thoughtId]: parseInt(cur.count, 10) || 0,
    }), {});

    return rankedThoughts.map((thought) => {
        const candidates = replyCandidatesByThoughtId[thought.id];
        if (!candidates?.length) {
            return thought;
        }

        const topReply = [...candidates].sort((a, b) => (likeCountByReplyId[b.id] || 0) - (likeCountByReplyId[a.id] || 0)
            || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

        return {
            ...thought,
            shouldAutoExpand: true,
            topReply: {
                ...topReply,
                likeCount: likeCountByReplyId[topReply.id] || 0,
            },
        };
    });
};

const searchActiveThoughts = async (req: any, res: any) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const {
        limit,
        offset,
        order,
        blockedUsers,
        shouldHideMatureContent,
        withMedia,
        withUser,
        withReplies,
        withBookmark,
        lastContentCreatedAt,
        authorId,
    } = req.body;

    const conditions: any = {
        userId,
        userHasActivated: true,
    };

    // Hide reported content
    if (shouldHideMatureContent) {
        conditions.userHasReported = false;
    }

    const customs: any = {};
    if (withBookmark) {
        customs.withBookmark = true;
    }

    let reactions;

    // TODO: Debug limit where public thoughts exceed reactions causing reactions to be missing during pagination
    // Get reactions should use a lastContentCreatedAt that excludes public thoughts with no reactions
    return Store.thoughtReactions.get(conditions, undefined, {
        limit,
        offset,
        order: order || 'DESC',
    }, customs)
        .then((reactionsResponse) => {
            reactions = reactionsResponse;
            const thoughtIdToReaction = reactions?.reduce((acc, cur) => ({
                ...acc,
                [cur.thoughtId]: cur,
            }), {});
            const thoughtIds = reactions?.map((reaction) => reaction.thoughtId) || [];

            return internalRestRequest({
                headers: req.headers,
            }, {
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/thoughts/find`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
                    'x-therr-origin-host': whiteLabelOrigin,
                },
                data: {
                    thoughtIds,
                    limit,
                    order,
                    withMedia,
                    withUser,
                    withReplies,
                    lastContentCreatedAt,
                    authorId,
                    isDraft: false,
                },
            }).then(async (response) => {
                let thoughts = response?.data?.thoughts;
                const results = await Store.thoughtReactions.getCounts(thoughts.map((m) => m.id), {}, 'userHasLiked');
                const likeCountByThoughtId = results.reduce((acc, cur) => ({
                    ...acc,
                    [cur.thoughtId]: cur.count,
                }), {});
                const nowMs = Date.now();
                thoughts = thoughts.map((thought) => {
                    const alteredThought = {
                        ...thought,
                        reaction: thoughtIdToReaction[thought.id] || {},
                        likeCount: parseInt(likeCountByThoughtId[thought.id] || 0, 10),
                    };
                    return {
                        ...alteredThought,
                        // Personalized relevance: recency decay x engagement x interest match
                        // (interestMatchScore is attached by users-service per requesting user)
                        rankingScore: getContentRankingScore(alteredThought, undefined, nowMs),
                    };
                }).filter((thought) => !blockedUsers.includes(thought.fromUserId));

                thoughts = await attachThreadExpansions(thoughts, nowMs);

                return res.status(200).send({
                    thoughts,
                    media: response?.data?.media,
                    pagination: {
                        itemsPerPage: limit,
                        offset,
                        isLastPage: reactions.length < limit && response?.data?.isLastPage,
                    },
                });
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:THOUGHT_REACTIONS_ROUTES:ERROR' }));
};

const searchBookmarkedThoughts = async (req: any, res: any) => {
    req.body.withBookmark = true;

    return searchActiveThoughts(req, res);
};

export {
    searchActiveThoughts,
    searchBookmarkedThoughts,
};
