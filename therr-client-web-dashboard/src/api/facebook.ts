import axios from 'axios';

const getMe = (accessToken) => axios({
    method: 'get',
    // eslint-disable-next-line max-len
    url: `https://graph.facebook.com/v18.0/me?fields=id,first_name,last_name,email&access_token=${accessToken}`,
}).catch((err) => ({
    data: {
        errors: err.response?.data?.error,
    },
}));

/**
 * Returns account ids and page access tokens for future requests
 */
const getMyAccounts = (accessToken) => axios({
    method: 'get',
    // eslint-disable-next-line max-len
    url: `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`,
}).then(({ data }) => data).catch((err) => ({
    data: {
        errors: err.response?.data?.error,
    },
}));

export {
    getMe,
    getMyAccounts,
};
