import axios from 'axios';
import logSpan from 'therr-js-utilities/log-or-update-span';
import * as globalConfig from '../../../../../global-config';

const getCurrentUser = (headers) => axios({
    method: 'get',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/me`,
    headers: {
        authorization: headers.authorization,
        'x-localecode': headers.locale,
        'x-userid': headers.userId,
        'x-therr-origin-host': headers.whiteLabelOrigin,
    },
}).catch((err) => {
    logSpan({
        level: 'error',
        messageOrigin: 'API_SERVER',
        messages: ['Error while fetching user details'],
        traceArgs: {
            'error.message': err?.message,
        },
    });
});

export {
    getCurrentUser,
};
