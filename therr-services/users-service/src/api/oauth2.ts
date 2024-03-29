/* eslint-disable camelcase */
import axios from 'axios';
import FormData from 'form-data';
import * as globalConfig from '../../../../global-config';

const oAuthFacebook = (authCode: string, {
    isDashboard = false,
    isSocialSync = false,
}) => {
    const appId = process.env.FACEBOOK_APP_ID || '';
    const appSecret = process.env.FACEBOOK_APP_SECRET || '';

    const userAuthCodeSplit = (authCode || '').split('#_');
    const userAuthCode = userAuthCodeSplit[0] || authCode || '';
    const form = new FormData();

    const redirectUrl = isDashboard
        ? 'https://api.therr.com/v1/users-service/social-sync/oauth2-dashboard-facebook'
        : 'https://api.therr.com/v1/users-service/social-sync/oauth2-facebook';
    const frontendRedirectUrl = isDashboard
        ? `${globalConfig[process.env.NODE_ENV].dashboardHostFull}/oauth2/facebook-instagram`
        : `${globalConfig[process.env.NODE_ENV].hostFull}/facebook-instagram`;
    const redirectMatchUrl = isSocialSync ? redirectUrl : frontendRedirectUrl;

    form.append('client_id', appId);
    form.append('client_secret', appSecret);
    form.append('grant_type', 'authorization_code');
    form.append('redirect_uri', redirectMatchUrl); // Required for FB validation of matching url
    form.append('response_type', 'code');
    form.append('code', userAuthCode);

    // Success response should redirect back to this same endpoint
    return axios({
        method: 'post',
        url: 'https://graph.facebook.com/v18.0/oauth/access_token',
        headers: form.getHeaders(),
        data: form,
    }).then((response) => {
        const {
            access_token,
            error_message,
            error_type,
        } = response.data;

        if (error_type && !isSocialSync) {
            console.error({
                access_token,
                error_message,
                error_type,
            });
            return Promise.reject(new Error('Facebook auth failed'));
        }

        return response?.data;
    }).catch((error) => {
        if (isSocialSync) {
            return Promise.reject(error);
        }

        return Promise.reject(new Error('Facebook auth failed'));
    });
};

// TODO: Add method for long lived token
// https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/
// eslint-disable-next-line max-len
// "https://graph.facebook.com/{graph-api-version}/oauth/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={app-secret}&fb_exchange_token={your-access-token}"

// TODO: Add method for token refresh
// https://developers.facebook.com/docs/instagram-basic-display-api/reference/refresh_access_token

export {
    oAuthFacebook,
};
