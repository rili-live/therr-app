import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import * as globalConfig from '../../../../global-config';

const incrementInterestEngagement = (interestsKeys: string[], incrBy: number, headers: InternalConfigHeaders) => {
    if (!interestsKeys?.length) {
        return Promise.resolve({});
    }

    return internalRestRequest({
        headers,
    }, {
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/interests/increment`,
        data: {
            interestDisplayNameKeys: interestsKeys,
            incrBy,
        },
    }).catch((err) => {
        console.log(err);
    });
};

export default incrementInterestEngagement;
