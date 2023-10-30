/* eslint-disable camelcase */
import axios from 'axios';
import FormData from 'form-data';

const oAuthFacebook = (authCode: string, isDashboard = false, isSocialSync = false) => {
    const appId = process.env.FACEBOOK_APP_ID || '';
    const appSecret = process.env.FACEBOOK_APP_SECRET || '';

    const userAuthCodeSplit = (authCode || '').split('#_');
    const userAuthCode = userAuthCodeSplit[0] || authCode || '';
    const form = new FormData();

    const redirectUrl = isDashboard
        ? 'https://api.therr.com/v1/users-service/social-sync/oauth2-dashboard-facebook'
        : 'https://api.therr.com/v1/users-service/social-sync/oauth2-facebook';
    const frontendRedirectUrl = isDashboard ? 'https://dashboard.therr.com/oauth2/facebook-instagram' : 'https://therr.com/oauth2/facebook-instagram';
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

export {
    oAuthFacebook,
};
