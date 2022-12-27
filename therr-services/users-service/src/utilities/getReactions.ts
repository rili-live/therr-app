import axios from 'axios';
import * as globalConfig from '../../../../global-config';

const baseReactionsServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseReactionsServiceRoute;

export default (thoughtId: string, headers) => axios({
    method: 'get',
    url: `${baseReactionsServiceRoute}/thought-reactions/${thoughtId}`,
    headers,
})
    .then(({ data: thoughtReaction }) => !!(thoughtReaction && thoughtReaction.userHasActivated))
    .catch((err) => {
        if (err?.response?.data?.statusCode === 403) {
            return false;
        }
        throw err;
    });
