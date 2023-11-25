import axios from 'axios';
import { passthroughAndLogErrors } from './utils';

/**
 * Creates an ad
 */
const createAd = (
    context: {
        accessToken: string;
        adAccountId: string;
        pageId: string;
    },
    ad: {
        name: string;
    },
) => axios({
    method: 'post',
    // eslint-disable-next-line max-len
    url: `https://graph.facebook.com/v18.0/${context.adAccountId}/adcreatives?access_token=${context.accessToken}`,
    params: {
        name: `[automated] ${ad.name}`,
        object_story_spec: {
            link: 'www.therr.com',
            message: 'Test Ad',
        },
        page_id: context.pageId,
    },
}).catch((err) => ({
    data: {
        errors: err.response?.data?.error,
    },
})).then(passthroughAndLogErrors);

export {
    createAd,
};
