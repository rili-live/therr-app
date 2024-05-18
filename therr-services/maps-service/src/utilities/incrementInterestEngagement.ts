import axios from 'axios';
import * as globalConfig from '../../../../global-config';

const incrementInterestEngagement = (interestsKeys: string[], incrBy: number, headers: {
    authorization: string;
    locale: string;
    userId: string;
    whiteLabelOrigin: string;
}) => {
    if (!interestsKeys?.length) {
        return Promise.resolve({});
    }

    return axios({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/interests/increment`,
        headers: {
            authorization: headers.authorization,
            'x-localecode': headers.locale,
            'x-userid': headers.userId,
            'x-therr-origin-host': headers.whiteLabelOrigin,
        },
        data: {
            interestDisplayNameKeys: interestsKeys,
            incrBy,
        },
    }).catch((err) => {
        console.log(err);
    });
};

export default incrementInterestEngagement;
