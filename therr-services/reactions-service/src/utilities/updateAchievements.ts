import axios from 'axios';
import logSpan from 'therr-js-utilities/log-or-update-span';
import * as globalConfig from '../../../../global-config';

const getTier = (reactionBody) => {
    if (reactionBody.userHasLiked) {
        return '1_1';
    }
    if (reactionBody.userHasSuperLiked) {
        return '1_2';
    }

    return '';
};

const updateAchievements = (headers, reqBody, existingReaction?): Promise<any> => {
    // Prevents spam liking
    if (existingReaction?.userHasLiked && reqBody.userHasLiked) {
        return Promise.resolve();
    }
    if (existingReaction?.userHasSuperLiked && reqBody.userHasSuperLiked) {
        return Promise.resolve();
    }
    const tier = getTier(reqBody);

    if (!tier) {
        return Promise.resolve();
    }

    return axios({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/achievements`,
        headers: {
            authorization: headers.authorization,
            'x-localecode': headers.locale,
            'x-userid': headers.userId,
        },
        data: {
            achievementClass: 'influencer',
            achievementTier: tier,
            progressCount: 1,
        },
    }).catch((err) => {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Error while updating achievements'],
            traceArgs: {
                'error.message': err?.message,
            },
        });
    });
};

export default updateAchievements;
