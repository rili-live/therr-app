import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
// import translate from '../utilities/translator';
import * as globalConfig from '../../../../global-config';

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
        // Order the stream by the score the distributor assigned at activation time.
        // Without this the feed is ordered by activation timestamp, and since a distributor
        // run activates 7-20 thoughts at once, intra-batch order was arbitrary.
        orderBy: 'relevance',
    }, customs)
        .then((reactionsResponse) => {
            reactions = reactionsResponse;
            const thoughtIdToReaction = reactions?.reduce((acc, cur) => ({
                ...acc,
                [cur.thoughtId]: cur,
            }), {});
            const thoughtIds = reactions?.map((reaction) => reaction.thoughtId) || [];
            // The reaction query above is what ranks this page; the thoughts lookup below
            // re-sorts by content createdAt, so keep the ranked positions to restore after.
            const rankByThoughtId = new Map<string, number>();
            thoughtIds.forEach((id, index) => rankByThoughtId.set(id, index));

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
                    // `lastContentCreatedAt` becomes a `createdAt <` filter in users-service.
                    // That is a valid cursor only while the page is ordered by content
                    // recency. On the activated feed the page is now ordered by relevance and
                    // already scoped to this page's thoughtIds, so forwarding the cursor would
                    // silently drop any high-scoring thought newer than the last item of the
                    // previous page. The author-profile path (authorId set) bypasses the
                    // thoughtIds restriction and still paginates by createdAt, so it keeps it.
                    lastContentCreatedAt: authorId ? lastContentCreatedAt : undefined,
                    authorId,
                    isDraft: false,
                },
            }).then(async (response) => {
                let thoughts = response?.data?.thoughts;
                // Include reply preview ids so inline thread previews can surface the top reply by likes
                const replyIds = thoughts.reduce((acc, m) => acc.concat((m.replies || []).map((reply) => reply.id)), []);
                const results = await Store.thoughtReactions.getCounts([...thoughts.map((m) => m.id), ...replyIds], {}, 'userHasLiked');
                const likeCountByThoughtId = results.reduce((acc, cur) => ({
                    ...acc,
                    [cur.thoughtId]: cur.count,
                }), {});
                thoughts = thoughts.map((thought) => {
                    const alteredThought = thought; // TODO: personalized for user performing the search?
                    return {
                        ...alteredThought,
                        reaction: thoughtIdToReaction[thought.id] || {},
                        likeCount: parseInt(likeCountByThoughtId[thought.id] || 0, 10),
                        replies: thought.replies
                            ?.filter((reply) => !blockedUsers.includes(reply.fromUserId))
                            .map((reply) => ({
                                ...reply,
                                likeCount: parseInt(likeCountByThoughtId[reply.id] || 0, 10),
                            })),
                    };
                }).filter((thought) => !blockedUsers.includes(thought.fromUserId));

                // Restore the relevance ordering the thoughts lookup discarded. Anything not
                // in the rank map (shouldn't happen — every thought here came from a reaction)
                // sinks to the bottom rather than jumping to the top.
                thoughts.sort((a, b) => (rankByThoughtId.get(a.id) ?? Number.MAX_SAFE_INTEGER)
                    - (rankByThoughtId.get(b.id) ?? Number.MAX_SAFE_INTEGER));

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
