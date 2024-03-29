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
    url: `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`,
}).then(({ data }) => data).catch((err) => ({
    data: {
        errors: err.response?.data?.error,
    },
}));

const getMyAdAccounts = (accessToken) => axios({
    method: 'get',
    // eslint-disable-next-line max-len
    url: `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name&access_token=${accessToken}`,
}).then(({ data }) => data).catch((err) => ({
    data: {
        errors: err.response?.data?.error,
    },
}));

const getMyIGAccounts = (fbPageAccessToken, fbPageId) => axios({
    method: 'get',
    // eslint-disable-next-line max-len
    url: `https://graph.facebook.com/v18.0/${fbPageId}/instagram_accounts?fields=id,username,followed_by_count,follow_count&access_token=${fbPageAccessToken}`,
}).then(({ data }) => data).catch((err) => ({
    data: {
        errors: err.response?.data?.error,
    },
}));

const getCampaignResults = (accessToken, adAccountId, campaignId) => axios({
    method: 'get',
    // eslint-disable-next-line max-len
    url: `https://graph.facebook.com/v18.0/${adAccountId}/insights?breakdowns=publisher_platform&fields=ad_id,clicks,unique_clicks,cpm,impressions,reach,spend&default_summary=true&date_preset=maximum&filtering=[{field: "campaign.id",operator:"IN", value: ['${campaignId}']},{"field":"publisher_platform","operator":"CONTAIN","value":"facebook"}]&access_token=${accessToken}`,
}).then(({ data }) => data).catch((err) => ({
    data: {
        errors: err.response?.data?.error,
    },
}));

export {
    getMe,
    getMyAccounts,
    getMyAdAccounts,
    getMyIGAccounts,
    getCampaignResults
};
