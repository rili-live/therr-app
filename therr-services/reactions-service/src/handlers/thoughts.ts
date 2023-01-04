import axios from 'axios';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
// import translate from '../utilities/translator';
import * as globalConfig from '../../../../global-config';

const searchActiveThoughts = async (req: any, res: any) => {
    const authorization = req.headers.authorization;
    const userId = req.headers['x-userid'];
    const locale = req.headers['x-localecode'] || 'en-us';
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
            const thoughtIds = reactions?.map((reaction) => reaction.thoughtId) || [];

            return axios({
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/thoughts/find`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
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
                },
            });
        })
        .then((response) => {
            let thoughts = response?.data?.thoughts;
            thoughts = thoughts.map((thought) => {
                const alteredThought = thought; // TODO: personalized for user performing the search?
                return {
                    ...alteredThought,
                    reaction: reactions.find((reaction) => reaction.thoughtId === thought.id) || {},
                };
            }).filter((thought) => !blockedUsers.includes(thought.fromUserId));
            return res.status(200).send({
                thoughts,
                media: response?.data?.media,
                pagination: {
                    itemsPerPage: limit,
                    offset,
                    isLastPage: response?.data?.thoughts?.length < limit,
                },
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
