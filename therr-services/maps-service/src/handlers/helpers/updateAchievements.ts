import axios from 'axios';
import logSpan from 'therr-js-utilities/log-or-update-span';
import * as globalConfig from '../../../../../global-config';

const getTier = (reqBody) => {
    if (reqBody) {
        return '1_3';
    }

    return '';
};

const updateAchievements = (headers, reqBody): Promise<any> => {
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
            'x-therr-origin-host': headers.whiteLabelOrigin,
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
