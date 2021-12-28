import axios from 'axios';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
// import translate from '../utilities/translator';
import * as globalConfig from '../../../../global-config';

const searchActiveSpaces = async (req: any, res: any) => {
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
        withBookmark,
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

    return Store.spaceReactions.get(conditions, undefined, {
        limit: limit || 50,
        offset,
        order: order || 0,
    }, customs)
        .then((reactionsResponse) => {
            reactions = reactionsResponse;
            const spaceIds = reactions?.map((reaction) => reaction.spaceId) || [];

            return axios({
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseMapsServiceRoute}/spaces/find`,
                headers: {
                    authorization,
                    'x-localecode': locale,
                    'x-userid': userId,
                },
                data: {
                    spaceIds,
                    order,
                    withMedia,
                    withUser,
                },
            });
        })
        .then((response) => {
            let spaces = response?.data?.spaces;
            spaces = spaces.map((space) => ({
                ...space,
                reaction: reactions.find((reaction) => reaction.spaceId === space.id) || {},
            })).filter((space) => !blockedUsers.includes(space.fromUserId));
            return res.status(200).send({
                spaces,
                media: response?.data?.media,
                pagination: {
                    itemsPerPage: limit,
                    offset,
                    isLastPage: response?.data?.spaces?.length < limit,
                },
            });
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:SPACE_REACTIONS_ROUTES:ERROR' }));
};

const searchBookmarkedSpaces = async (req: any, res: any) => {
    req.body.withBookmark = true;

    return searchActiveSpaces(req, res);
};

export {
    searchActiveSpaces,
    searchBookmarkedSpaces,
};
