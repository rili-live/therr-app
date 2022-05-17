import { RequestHandler } from 'express';
import axios from 'axios';
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
        url: `https://api.twitter.com/2/users/by/username/${params.username}?user.fields=public_metrics,url`,
        headers: { Authorization: `Bearer ${twitterBearerToken}` },
    }),
};

const extractPlatformProfileDetails = (platform: IPlatform, responseData) => {
    if (platform === 'twitter') {
        return {
            platformUsername: responseData.data?.username,
            platformUserId: responseData.data?.id,
            link: responseData.data?.url,
            displayName: 'Twitter',
            followerCount: responseData.data?.public_metrics?.followers_count,
        };
    }

    return {};
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
        const response = {};
        Object.keys(socialPlatformApis).forEach((platform, index) => {
            response[platform] = responses[index]?.data;
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

        return Store.socialSyncs.createOrUpdateSyncs(dbRecords).then(() => res.status(200).send(response));
    }).catch((err) => handleHttpError({
        err,
        res,
        message: 'SQL:USER_ROUTES:ERROR',
    }));
};

export {
    createUpdateSocialSyncs,
};
