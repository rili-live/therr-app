import axios from 'axios';
import { passthroughAndLogErrors } from './utils';

const getMe = (accessToken) => axios({
    method: 'get',
    // eslint-disable-next-line max-len
    url: `https://graph.facebook.com/v18.0/me?fields=id,first_name,last_name,email&access_token=${accessToken}`,
}).catch((err) => ({
    data: {
        errors: err.response?.data?.error,
    },
})).then(passthroughAndLogErrors);

/**
 * Returns account ids and page access tokens for future requests
 */
const getMyAccounts = (accessToken) => axios({
    method: 'get',
    // eslint-disable-next-line max-len
    url: `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`,
}).catch((err) => ({
    data: {
        errors: err.response?.data?.error,
    },
})).then(passthroughAndLogErrors);

export {
    getMe,
    getMyAccounts,
};
