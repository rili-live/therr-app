import axios from 'axios';
import * as globalConfig from '../../../../global-config';

const baseUsersServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseReactionsServiceRoute;

export default (momentId: string, headers) => axios({
    method: 'get',
    url: `${baseUsersServiceRoute}/moment-reactions/${momentId}`,
    headers,
})
    .then(({ data: momentReaction }) => !!(momentReaction && momentReaction.userHasActivated))
    .catch((err) => {
        if (err?.response?.data?.statusCode === 403) {
            return false;
        }
        throw err;
    });
