/* eslint-disable camelcase */
import { RequestHandler } from 'express';
import axios from 'axios';
import qs from 'qs';
import FormData from 'form-data';
import printLogs from 'therr-js-utilities/print-logs';
import beeline from '../beeline';
// import { ErrorCodes } from 'therr-js-utilities/constants';
// import printLogs from 'therr-js-utilities/print-logs';
// import beeline from '../beeline';
import handleHttpError from '../utilities/handleHttpError';
import sendSocialSyncAdminNotificationEmail from '../api/email/admin/sendSocialSyncAdminNotificationEmail';
import Store from '../store';
import { ICreateOrUpdateParams } from '../store/SocialSyncsStore';

type IPlatform = 'twitter' | 'instagram' | 'tiktok' | 'youtube';

const twitterBearerToken = process.env.TWITTER_APP_BEARER_TOKEN;

const socialPlatformApis = {
    instagram: {
        getProfile: (params: { userId: string, accessToken: string }) => axios({
            method: 'get',
            url: `https://graph.instagram.com/v14.0/${params.userId}?fields=id,username,account_type,media_count,media&access_token=${params.accessToken}`,
            headers: { Authorization: `Bearer ${twitterBearerToken}` },
        }).catch((err) => ({
            data: {
                errors: err.response?.data?.error,
            },
        })),
    },
    twitter: {
        getProfile: (params: { username: string }) => axios({
            method: 'get',
            url: `https://api.twitter.com/2/users/by/username/${params.username}?user.fields=created_at,verified,location,url,description,public_metrics`,
            headers: { Authorization: `Bearer ${twitterBearerToken}` },
        }),
    },
};

const extractPlatformProfileDetails = (platform: IPlatform, responseData) => {
    if (platform === 'twitter') {
        return {
            platformUsername: responseData.data?.username,
            platformUserId: responseData.data?.id,
            link: `https://twitter.com/${responseData.data?.username}`,
            displayName: 'Twitter',
            followerCount: responseData.data?.public_metrics?.followers_count,
        };
    }
    if (platform === 'instagram') {
        return {
            platformUsername: responseData?.username,
            platformUserId: responseData?.id,
            link: `https://instagram.com/${responseData?.username}`,
            displayName: 'Instagram',
            followerCount: responseData?.media_count || 1, // TODO: Need to user IG Graph api to get this
        };
    }

    return {};
};

export const getMappedSocialSyncResults = (isMe: boolean, results: any[]) => {
    const mappedResults = {};

    results.forEach((result) => {
        if (isMe) {
            mappedResults[result.platform] = {
                ...result,
                followerCount: parseInt(result.followerCount || 0, 10),
            };
        } else {
            mappedResults[result.platform] = {
                platform: result.platform,
                platformUserName: result.platformUserName,
                displayName: result.displayName,
                link: result.link,
                followerCount: parseInt(result.followerCount || 0, 10),
                customIconName: result.customIconName,
                updatedAt: result.updatedAt,
            };
        }
    });

    return mappedResults;
};

// CREATE
const createUpdateSocialSyncs: RequestHandler = (req: any, res: any) => {
    const userId = req.headers['x-userid'];
    const socialPlatformPromises: Promise<any>[] = [];
    const { syncs } = req.body;

    Object.keys(socialPlatformApis).forEach((key) => {
        if (syncs[key]) {
            if (key === 'instagram') {
            // Fire and forget: Notify admin of social sync for manual geotagging
                sendSocialSyncAdminNotificationEmail({
                    subject: 'New IG Social Sync',
                    toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                }, {
                    userId,
                });
            }
            socialPlatformPromises.push(socialPlatformApis[key]?.getProfile(syncs[key]));
        } else {
            socialPlatformPromises.push(Promise.resolve());
        }
    });

    return Promise.all(socialPlatformPromises).then((responses) => {
        // TODO: Store response details in socialSyncs table
        const dbRecords: ICreateOrUpdateParams[] = [];
        const errors: any = {};
        let instagramMedia = {};
        Object.keys(socialPlatformApis).forEach((platform, index) => {
            // NOTE: this is specific to twitter response object
            if (responses[index]) {
                if (!responses[index].data?.errors) {
                    const profileDetails = extractPlatformProfileDetails(platform as IPlatform, responses[index]?.data);
                    const record: any = {
                        userId,
                        platform,
                        ...profileDetails,
                    };

                    if (platform === 'instagram') {
                        instagramMedia = responses[index]?.data?.media;
                    }

                    dbRecords.push(record);
                } else {
                    errors[platform] = responses[index].data?.errors;
                }
            }
        });

        return Store.socialSyncs.createOrUpdateSyncs(dbRecords)
            .then(() => Store.socialSyncs.getSyncs(userId)) // fetch all for user
            .then((results) => {
                const mappedResults = getMappedSocialSyncResults(true, results);

                return res.status(200).send({ syncs: mappedResults, errors, instagramMedia });
            });
    }).catch((err) => handleHttpError({
        err,
        res,
        message: 'SQL:USER_ROUTES:ERROR',
    }));
};

// GET
const getSocialSyncs: RequestHandler = (req: any, res: any) => {
    const authUserId = req.headers['x-userid'];
    const { userId } = req.params;

    return Store.socialSyncs.getSyncs(userId)
        .then((results) => {
            const mappedResults = getMappedSocialSyncResults(userId === authUserId, results);

            return res.status(200).send({ syncs: mappedResults });
        })
        .catch((err) => handleHttpError({
            err,
            res,
            message: 'SQL:USER_ROUTES:ERROR',
        }));
};

const facebookAppAuth: RequestHandler = (req: any, res: any) => {
    const appId = process.env.FACEBOOK_APP_ID || '';
    const appSecret = process.env.FACEBOOK_APP_SECRET || '';
    const redirectUrl = 'https://api.therr.com/v1/users-service/social-sync/oauth2-facebook';
    const frontendRedirectUrl = 'https://therr.com';
    const {
        code,
        error,
        error_reason,
        error_description,
    } = req.query;

    if (error) {
        printLogs({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed FB Authorization Request'],
            tracer: beeline,
            traceArgs: {
                error,
                error_reason,
                error_description,
            },
        });
        return res.status(301).send({ redirectUrl: `${frontendRedirectUrl}?${qs.stringify({ error, error_reason, error_description })}` });
    }

    const userAuthCodeSplit = (code || '').split('#_');
    const userAuthCode = userAuthCodeSplit[0] || code || '';
    const form = new FormData();
    form.append('client_id', appId);
    form.append('client_secret', appSecret);
    form.append('grant_type', 'authorization_code');
    form.append('redirect_uri', redirectUrl); // Required for FB validation of matching url
    form.append('response_type', 'code');
    form.append('code', userAuthCode);

    // Success response should redirect back to this same endpoint
    return axios({
        method: 'post',
        url: 'https://graph.facebook.com/v14.0/oauth/access_token',
        headers: form.getHeaders(),
        data: form,
    }).then((response) => {
        const {
            access_token,
            error_message,
            error_type,
            user_id,
        } = response.data;

        if (error_type) {
            return res.status(301).send({ redirectUrl: `${frontendRedirectUrl}?${qs.stringify({ error_type, error_message })}` });
        }
        return res.status(301).send({ redirectUrl: `${frontendRedirectUrl}?${qs.stringify({ access_token, user_id })}` });
    }).catch((errResponse) => {
        const {
            error_message,
            error_type,
        } = errResponse?.response?.data || {};

        printLogs({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed FB OAuth Request'],
            tracer: beeline,
            traceArgs: {
                error_message,
                error_type,
                ...errResponse?.response?.data,
                theHell1: errResponse?.toString(),
                theHell2: errResponse?.response?.toString(),
            },
        });

        return res.status(301).send({ redirectUrl: `${frontendRedirectUrl}?${qs.stringify({ error_type, error_message, handled_error: true })}` });
    });
};

const instagramAppAuth: RequestHandler = (req: any, res: any) => {
    const appId = process.env.INSTAGRAM_APP_ID || '';
    const appSecret = process.env.INSTAGRAM_APP_SECRET || '';
    const redirectUrl = 'https://api.therr.com/v1/users-service/social-sync/oauth2-instagram';
    const frontendRedirectUrl = 'https://therr.com';
    const {
        code,
        error,
        error_reason,
        error_description,
    } = req.query;

    if (error) {
        printLogs({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed IG Authorization Request'],
            tracer: beeline,
            traceArgs: {
                error,
                error_reason,
                error_description,
            },
        });
        return res.status(301).send({ redirectUrl: `${frontendRedirectUrl}?${qs.stringify({ error, error_reason, error_description })}` });
    }

    const userAuthCodeSplit = (code || '').split('#_');
    const userAuthCode = userAuthCodeSplit[0] || code || '';
    const form = new FormData();
    form.append('client_id', appId);
    form.append('client_secret', appSecret);
    form.append('grant_type', 'authorization_code');
    form.append('redirect_uri', redirectUrl); // Required for IG validation of matching url
    form.append('response_type', 'code');
    form.append('code', userAuthCode);

    // Success response should redirect back to this same endpoint
    return axios({
        method: 'post',
        url: 'https://api.instagram.com/oauth/access_token',
        headers: form.getHeaders(),
        data: form,
    }).then((response) => {
        const {
            access_token,
            error_message,
            error_type,
            user_id,
        } = response.data;

        if (error_type) {
            return res.status(301).send({ redirectUrl: `${frontendRedirectUrl}?${qs.stringify({ error_type, error_message })}` });
        }
        return res.status(301).send({ redirectUrl: `${frontendRedirectUrl}?${qs.stringify({ access_token, user_id })}` });
    }).catch((errResponse) => {
        const {
            error_message,
            error_type,
        } = errResponse?.response?.data || {};

        printLogs({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed IG OAuth Request'],
            tracer: beeline,
            traceArgs: {
                error_message,
                error_type,
                ...errResponse?.response?.data,
                theHell1: errResponse?.toString(),
                theHell2: errResponse?.response?.toString(),
            },
        });

        return res.status(301).send({ redirectUrl: `${frontendRedirectUrl}?${qs.stringify({ error_type, error_message, handled_error: true })}` });
    });
};

export {
    getSocialSyncs,
    createUpdateSocialSyncs,
    facebookAppAuth,
    instagramAppAuth,
};
