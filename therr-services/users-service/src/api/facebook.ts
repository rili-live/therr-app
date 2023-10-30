import axios from 'axios';

const getMe = (accessToken) => axios({
    method: 'get',
    // eslint-disable-next-line max-len
    url: `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,instagram_business_account{username,media,followers_count,media_count}&access_token=${accessToken}`,
}).catch((err) => ({
    data: {
        errors: err.response?.data?.error,
    },
}));

export {
    getMe,
};
