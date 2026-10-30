import { internalRestRequest } from 'therr-js-utilities/internal-rest-request';
import { parseHeaders } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
// import translate from '../utilities/translator';
import * as globalConfig from '../../../../global-config';

/**
 * The most reaction pages one stream request reads while looking past thoughts the requesting brand
 * cannot see. Bounds the cost of a page for an account whose stream is mostly another brand's.
 */
export const MAX_STREAM_SCAN_PASSES = 5;

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

    // Relevance ranking belongs to the stream only. With `authorId` set this endpoint serves
    // an author's profile, which is reverse-chronological and (for your own or a friend's
    // profile) is not even restricted to activated thoughts — see `ThoughtsStore.find`.
    const isRelevanceRanked = !authorId;

    // TODO: Debug limit where public thoughts exceed reactions causing reactions to be missing during pagination
    // Get reactions should use a lastContentCreatedAt that excludes public thoughts with no reactions
    const fetchReactions = (pageOffset: number) => Store.thoughtReactions.get(conditions, undefined, {
        limit,
        offset: pageOffset,
        order: order || 'DESC',
        // Order the stream by the score the distributor assigned at activation time.
        // Without this the feed is ordered by activation timestamp, and since a distributor
        // run activates 7-20 thoughts at once, intra-batch order was arbitrary.
        orderBy: isRelevanceRanked ? 'relevance' : 'createdAt',
    }, customs);

    const findThoughts = (thoughtIds: string[]) => internalRestRequest({
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
            lastContentCreatedAt: isRelevanceRanked ? undefined : lastContentCreatedAt,
            authorId,
            isDraft: false,
        },
    });

    try {
        // Reaction rows carry no brand (they live in the reactions database), so a page of them
        // can be made of thoughts the requesting brand may not read, which the users-service
        // lookup then drops. An account that has used Therr holds hundreds of activated Therr
        // rows, and once the stream began ranking by relevance those outranked every habits
        // post: the Friends with Habits feed came back with full reaction pages and no
        // thoughts, rendered "nothing here yet", and never asked for page two.
        //
        // So on the stream, keep reading reaction pages while too little of the page survived,
        // up to a fixed number of passes. `itemsPerPage` below reports how many reaction rows
        // were consumed, which is what clients add to `offset` for the next page. The profile
        // path is not scanned: its lookup ignores the reaction ids altogether.
        const maxPasses = isRelevanceRanked ? MAX_STREAM_SCAN_PASSES : 1;
        const minThoughtsPerPage = Math.ceil((limit || 0) / 2);
        let reactions: any[] = [];
        let thoughts: any[] = [];
        let media: any;
        let isLookupLastPage: boolean | undefined;
        let lastBatchSize = 0;
        let scanOffset = offset || 0;

        for (let pass = 0; pass < maxPasses; pass += 1) {
            // Sequential by design: whether to read the next page depends on this one.
            // eslint-disable-next-line no-await-in-loop
            const batch = await fetchReactions(scanOffset) || [];
            lastBatchSize = batch.length;
            scanOffset += batch.length;
            reactions = reactions.concat(batch);

            // Called even for an empty batch: the profile path (your own or a friend's) does not
            // restrict the lookup to these ids, so it has thoughts to return with no reactions.
            // eslint-disable-next-line no-await-in-loop
            const response = await findThoughts(batch.map((reaction) => reaction.thoughtId));
            thoughts = thoughts.concat(response?.data?.thoughts || []);
            media = response?.data?.media ? { ...media, ...response.data.media } : media;
            isLookupLastPage = response?.data?.isLastPage;

            if (!batch.length || thoughts.length >= minThoughtsPerPage || batch.length < limit) {
                break;
            }
        }

        const thoughtIdToReaction = reactions.reduce((acc, cur) => ({
            ...acc,
            [cur.thoughtId]: cur,
        }), {});
        // The reaction query above is what ranks this page; the thoughts lookup re-sorts by
        // content createdAt, so keep the ranked positions to restore after.
        const rankByThoughtId = new Map<string, number>();
        reactions.forEach((reaction, index) => rankByThoughtId.set(reaction.thoughtId, index));

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
        //
        // Skipped on the author-profile path: there the lookup legitimately returns
        // thoughts that were never activated for the viewer, so ranking would hoist
        // whichever ones happen to be in the viewer's stream above the rest and
        // scramble the profile's reverse-chronological order.
        if (isRelevanceRanked) {
            thoughts.sort((a, b) => (rankByThoughtId.get(a.id) ?? Number.MAX_SAFE_INTEGER)
                - (rankByThoughtId.get(b.id) ?? Number.MAX_SAFE_INTEGER));
        }

        return res.status(200).send({
            thoughts,
            media,
            pagination: {
                // Reaction rows consumed, not thoughts returned — see the scan above. Equal to
                // `limit` for every full page that needed no scan, as it always was.
                itemsPerPage: isRelevanceRanked ? Math.max(scanOffset - (offset || 0), limit || 0) : limit,
                offset,
                isLastPage: lastBatchSize < limit && !!isLookupLastPage,
            },
        });
    } catch (err: any) {
        return handleHttpError({ err, res, message: 'SQL:THOUGHT_REACTIONS_ROUTES:ERROR' });
    }
};

const searchBookmarkedThoughts = async (req: any, res: any) => {
    req.body.withBookmark = true;

    return searchActiveThoughts(req, res);
};

export {
    searchActiveThoughts,
    searchBookmarkedThoughts,
};
