/* eslint-disable camelcase */
import { RequestHandler } from 'express';
import axios from 'axios';
import qs from 'qs';
import FormData from 'form-data';
// import { ErrorCodes } from 'therr-js-utilities/constants';
// import printLogs from 'therr-js-utilities/print-logs';
// import beeline from '../beeline';
import handleHttpError from '../utilities/handleHttpError';
import Store from '../store';
import { ICreateOrUpdateParams } from '../store/SocialSyncsStore';

type IPlatform = 'twitter' | 'instagram' | 'tiktok' | 'youtube';

const twitterBearerToken = process.env.TWITTER_APP_BEARER_TOKEN;

const socialPlatformApis = {
    twitter: (params: { username: string }) => axios({
        method: 'get',
        url: `https://api.twitter.com/2/users/by/username/${params.username}?user.fields=created_at,verified,location,url,description,public_metrics`,
        headers: { Authorization: `Bearer ${twitterBearerToken}` },
    }),
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
            socialPlatformPromises.push(socialPlatformApis[key](syncs[key]));
        } else {
            socialPlatformPromises.push(Promise.resolve());
        }
    });

    return Promise.all(socialPlatformPromises).then((responses) => {
        // TODO: Store response details in socialSyncs table
        const dbRecords: ICreateOrUpdateParams[] = [];
        Object.keys(socialPlatformApis).forEach((platform, index) => {
            // NOTE: this is specific to twitter response object
            if (!responses[index]?.data?.errors) {
                const profileDetails = extractPlatformProfileDetails(platform as IPlatform, responses[index]?.data);
                const record: any = {
                    userId,
                    platform,
                    ...profileDetails,
                };
                dbRecords.push(record);
            }
        });

        return Store.socialSyncs.createOrUpdateSyncs(dbRecords).then((results) => res.status(200).send(getMappedSocialSyncResults(true, results)));
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

const instagramAppAuth: RequestHandler = (req: any, res: any) => {
    const appId = process.env.INSTAGRAM_APP_ID || '';
    const appSecret = process.env.INSTAGRAM_APP_SECRET || '';
    const redirectUrl = 'https://therr.com/';
    const {
        code,
        error,
        error_reason,
        error_description,
    } = req.query;

    if (error) {
        return res.status(301).send({ redirectUrl: `${redirectUrl}?${qs.stringify({ error, error_reason, error_description })}` });
    }

    const userAuthCodeSplit = (code || '').split('#_');
    const userAuthCode = userAuthCodeSplit[0] || code || '';
    const form = new FormData();
    form.append('client_id', appId);
    form.append('client_secret', appSecret);
    form.append('grant_type', 'authorization_code');
    form.append('redirect_uri', redirectUrl);
    form.append('response_type', 'code');
    form.append('code', userAuthCode);

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
            return res.status(301).send({ redirectUrl: `${redirectUrl}?${qs.stringify({ error_type, error_message })}` });
        }
        return res.status(301).send({ redirectUrl: `${redirectUrl}?${qs.stringify({ access_token, user_id })}` });
    }).catch((errResponse) => {
        const {
            error_message,
            error_type,
        } = errResponse?.response?.data || {};

        return res.status(301).send({ redirectUrl: `${redirectUrl}?${qs.stringify({ error_type, error_message, handled_error: true })}` });
    });
};

export {
    getSocialSyncs,
    createUpdateSocialSyncs,
    instagramAppAuth,
};
