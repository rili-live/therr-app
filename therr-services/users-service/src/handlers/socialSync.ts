/* eslint-disable camelcase */
import { RequestHandler } from 'express';
import axios from 'axios';
import qs from 'qs';
import FormData from 'form-data';
import logSpan from 'therr-js-utilities/log-or-update-span';
// import { ErrorCodes } from 'therr-js-utilities/constants';
import handleHttpError from '../utilities/handleHttpError';
import sendSocialSyncAdminNotificationEmail from '../api/email/admin/sendSocialSyncAdminNotificationEmail';
import Store from '../store';
import { ICreateOrUpdateParams } from '../store/SocialSyncsStore';
import * as facebook from '../api/facebook';
import { oAuthFacebook } from '../api/oauth2';

// NOTE: facebook-instagram is an instagram account of type business/creator
// Login happens through Facebook business manager
type IPlatform = 'twitter' | 'facebook-instagram' | 'instagram' | 'tiktok' | 'youtube';

const twitterBearerToken = process.env.TWITTER_APP_BEARER_TOKEN;
const youtubeApiKey = process.env.GOOGLE_MAPS_PLACES_SERVER_SIDE_API_KEY;

const socialPlatformApis = {
    'facebook-instagram': {
        getProfile: (params: { userId: string, accessToken: string }) => facebook.getMe(params.accessToken),
    },
    // Legacy
    // instagram: {
    //     getProfile: (params: { userId: string, accessToken: string }) => axios({
    //         method: 'get',
    //         url: `https://graph.instagram.com/v14.0/${params.userId}?fields=id,username,account_type,media_count,media&access_token=${params.accessToken}`,
    //     }).catch((err) => ({
    //         data: {
    //             errors: err.response?.data?.error,
    //         },
    //     })),
    // },
    // Simplified
    instagram: {
        getProfile: (params: { username: string }) => Promise.resolve({
            data: {
                username: params.username,
                media_count: 5001,
                id: params.username,
            },
        }),
    },
    tiktok: {
        getProfile: (params: { username: string, accessToken: string }) => axios({
            method: 'post',
            url: 'https://open-api.tiktok.com/user/info/',
            data: {
                access_token: params.accessToken,
                fields: ['open_id', 'union_id', 'avatar_url', 'display_name', 'profile_deep_link'],
            },
        }),
    },
    twitter: {
        getProfile: (params: { username: string }) => axios({
            method: 'get',
            url: `https://api.twitter.com/2/users/by/username/${params.username}?user.fields=created_at,verified,location,url,description,public_metrics`,
            headers: { Authorization: `Bearer ${twitterBearerToken}` },
        }),
    },
    youtube: {
        getProfile: (params: { username: string }) => axios({
            method: 'get',
            url: `https://youtube.googleapis.com/youtube/v3/channels?part=snippet%2CcontentDetails%2Cstatistics&id=${params.username}&key=${youtubeApiKey}`,
        }).then((response) => {
            if (!response.data?.items?.length) {
                return ({
                    data: {
                        errors: 'not found',
                    },
                });
            }

            return response;
        }).catch((err) => ({
            data: {
                errors: err.response?.data?.error,
            },
        })),
    },
};

const extractPlatformProfileDetails = (platform: IPlatform, responseData) => {
    if (platform === 'tiktok') {
        return {
            platformUsername: responseData.data?.user?.display_name,
            platformUserId: responseData.data?.user?.open_id,
            link: responseData.data?.user?.profile_deep_link,
            displayName: 'TikTok',
            followerCount: responseData?.media_count || 1, // TODO: Create calculation for "Clout Score",
        };
    }
    if (platform === 'twitter') {
        return {
            platformUsername: responseData.data?.username,
            platformUserId: responseData.data?.id,
            link: `https://twitter.com/${responseData.data?.username}`,
            displayName: 'Twitter',
            followerCount: responseData.data?.public_metrics?.followers_count,
        };
    }
    if (platform === 'facebook-instagram') {
        const igProfile = responseData?.data[0]?.instagram_business_account || {};
        const facebookProfile = responseData?.data[0] || {};
        return {
            platformUsername: igProfile.username || facebookProfile.id,
            platformUserId: igProfile.id || facebookProfile.id,
            link: igProfile.username ? `https://instagram.com/${igProfile.username}` : `https://facebook.com/${facebookProfile.id}`,
            displayName: igProfile.username ? 'Instagram' : 'Facebook',
            followerCount: igProfile?.followers_count || 1, // TODO: Create calculation for "Clout Score"
        };
    }
    if (platform === 'instagram') {
        return {
            platformUsername: responseData?.username,
            platformUserId: responseData?.id,
            link: `https://instagram.com/${responseData?.username}`,
            displayName: 'Instagram',
            followerCount: responseData?.media_count || 1, // TODO: Create calculation for "Clout Score"
        };
    }
    if (platform === 'youtube') {
        return {
            platformUsername: responseData?.items[0]?.id,
            platformUserId: responseData?.items[0]?.id,
            // eslint-disable-next-line max-len
            link: `https://www.youtube.com/channel/${responseData?.items[0]?.id}`,
            displayName: 'Youtube',
            followerCount: responseData?.items[0]?.statistics.subscriberCount || 1, // TODO: Create calculation for "Clout Score"
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
            if (key === 'instagram' || key === 'facebook-instagram') {
                // Fire and forget: Notify admin of social sync for manual geotagging
                sendSocialSyncAdminNotificationEmail({
                    subject: key === 'instagram' ? 'New IG Social Sync' : 'New FB-IG Social Sync',
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
                    if (platform === 'facebook-instagram') {
                        instagramMedia = responses[index]?.data?.data[0]?.instagram_business_account?.media;
                    }

                    if (record.platformUsername) {
                        dbRecords.push(record);
                    } else if (platform) {
                        Store.socialSyncs.deleteSync(userId, platform);
                    }
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
    const frontendRedirectUrl = req.path.includes('dashboard') ? 'https://dashboard.therr.com' : 'https://therr.com';
    const {
        code,
        error,
        error_reason,
        error_description,
    } = req.query;

    // TODO: Verify requestId

    if (error) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed FB Authorization Request'],
            traceArgs: {
                error,
                'error.reason': error_reason,
                'error.description': error_description,
            },
        });
        return res.status(301).send({
            redirectUrl: `${frontendRedirectUrl}?${qs.stringify({
                error,
                error_reason,
                error_description,
                provider: 'facebook-instagram',
            })}`,
        });
    }

    const userAuthCodeSplit = (code || '').split('#_');
    const userAuthCode = userAuthCodeSplit[0] || code || '';

    // Success response should redirect back to this same endpoint
    return oAuthFacebook(userAuthCode, {
        isDashboard: req.path.includes('dashboard'),
        isSocialSync: true,
    }).then((response) => {
        const {
            access_token,
            error_message,
            error_type,
        } = response.data;

        if (error_type) {
            return res.status(301).send({
                redirectUrl: `${frontendRedirectUrl}?${qs.stringify({
                    error: true,
                    error_type,
                    error_message,
                    provider: 'facebook-instagram',
                })}`,
            });
        }

        return res.status(301).send({ redirectUrl: `${frontendRedirectUrl}?${qs.stringify({ access_token, provider: 'facebook-instagram' })}` });
    }).catch((errResponse) => {
        const {
            error_message,
            error_type,
        } = errResponse?.response?.data || {};

        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed FB OAuth Request'],
            traceArgs: {
                'error.message': error_message,
                'error.type': error_type,
                'facebook.errorStr': errResponse?.toString(),
                'facebook.errorResString': errResponse?.response?.toString(),
            },
        });

        return res.status(301).send({
            redirectUrl: `${frontendRedirectUrl}?${qs.stringify({
                error: true,
                error_type,
                error_message,
                handled_error: true,
                provider: 'facebook-instagram',
            })}`,
        });
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
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed IG Authorization Request'],
            traceArgs: {
                error,
                'error.reason': error_reason,
                'error.description': error_description,
            },
        });
        return res.status(301)
            .send({
                redirectUrl: `${frontendRedirectUrl}?${qs.stringify({
                    error,
                    error_reason,
                    error_description,
                    provider: 'instagram',
                })}`,
            });
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
            return res.status(301).send({
                redirectUrl: `${frontendRedirectUrl}?${qs.stringify({
                    error: true,
                    error_type,
                    error_message,
                    provider: 'instagram',
                })}`,
            });
        }
        return res.status(301).send({ redirectUrl: `${frontendRedirectUrl}?${qs.stringify({ access_token, user_id, provider: 'instagram' })}` });
    }).catch((errResponse) => {
        const {
            error_message,
            error_type,
        } = errResponse?.response?.data || {};

        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed IG OAuth Request'],
            traceArgs: {
                'error.message': error_message,
                'error.type': error_type,
                'instagram.theHell1': errResponse?.toString(),
                'instagram.theHell2': errResponse?.response?.toString(),
            },
        });

        return res.status(301).send({
            redirectUrl: `${frontendRedirectUrl}?${qs.stringify({
                error: true,
                error_type,
                error_message,
                handled_error: true,
                provider: 'instagram',
            })}`,
        });
    });
};

const tiktokAppAuth: RequestHandler = (req: any, res: any) => {
    const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
    const appSecret = process.env.TIKTOK_APP_SECRET || '';
    const frontendRedirectUrl = 'https://therr.com';
    const {
        code,
        error,
        error_reason,
        error_description,
    } = req.query;

    if (error) {
        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed TikTok Authorization Request'],
            traceArgs: {
                error,
                'error.reason': error_reason,
                'error.description': error_description,
            },
        });
        return res.status(301).send({
            redirectUrl: `${frontendRedirectUrl}?${qs.stringify({
                error,
                error_reason,
                error_description,
                provider: 'tiktok',
            })}`,
        });
    }

    let url_access_token = 'https://open-api.tiktok.com/oauth/access_token/';
    url_access_token += `?client_key=${clientKey}`;
    url_access_token += `&client_secret=${appSecret}`;
    url_access_token += `&code=${code}`;
    url_access_token += '&grant_type=authorization_code';

    // Success response should redirect back to this same endpoint
    return axios({
        method: 'post',
        url: url_access_token,
    }).then((response) => {
        const {
            data,
            message,
        } = response.data;
        const hasError = message === 'error';

        if (hasError) {
            return res.status(301)
                .send({
                    redirectUrl: `${frontendRedirectUrl}?${qs.stringify({
                        error: true,
                        error_type: data.error_code,
                        error_message: data.description,
                        provider: 'tiktok',
                    })}`,
                });
        }
        return res.status(301)
            .send({ redirectUrl: `${frontendRedirectUrl}?${qs.stringify({ access_token: data.access_token, user_id: data.open_id, provider: 'tiktok' })}` });
    }).catch((errResponse) => {
        const {
            error_message,
            error_type,
        } = errResponse?.response?.data || {};

        logSpan({
            level: 'error',
            messageOrigin: 'API_SERVER',
            messages: ['Failed TikTok OAuth Request'],
            traceArgs: {
                'error.message': error_message,
                'error.type': error_type,
                'tiktok.theHell1': errResponse?.toString(),
                'tiktok.theHell2': errResponse?.response?.toString(),
            },
        });

        return res.status(301).send({
            redirectUrl: `${frontendRedirectUrl}?${qs.stringify({
                error: true,
                error_type,
                error_message,
                handled_error: true,
                provider: 'tiktok',
            })}`,
        });
    });
};

export {
    getSocialSyncs,
    createUpdateSocialSyncs,
    facebookAppAuth,
    instagramAppAuth,
    tiktokAppAuth,
};
