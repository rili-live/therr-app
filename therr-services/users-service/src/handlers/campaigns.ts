import { ErrorCodes } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import Store from '../store';
import userMetricsService from '../api/userMetricsService';
import sendCampaignCreatedEmail from '../api/email/admin/sendCampaignCreatedEmail';

// CREATE
const createCampaign = async (req, res) => {
    const userId = req.headers['x-userid'];
    const authorization = req.headers.authorization;
    const locale = req.headers['x-localecode'] || 'en-us';

    const {
        creatorId,
        organizationId,
        assetIds,
        businessSpaceIds,
        title,
        description,
        type,
        status,
        targetDailyBudget,
        costBiddingStrategy,
        targetLanguages,
        targetLocations,
        scheduleStartAt,
        scheduleEndAt,
    } = req.body;

    // export interface ICreateCampaignParams {
    //     costBiddingStrategy: string; // active, paused, removed, etc.
    //     targetLanguages: string[];
    //     targetLocations?: ITargetLocations[];
    //     scheduleStartAt: Date;
    //     scheduleStopAt: Date;
    // }

    return Store.campaigns.createCampaign({
        creatorId: userId,
        // organizationId: , // TODO
        // assetIds: , // TODO
        // businessSpaceIds: , // TODO
        title,
        description,
        type,
        status: 'paused',
        targetDailyBudget: 0, // TODO
        costBiddingStrategy: 'default',
        targetLanguages: [locale],
        // targetLocations: , // TODO
        scheduleStartAt,
        scheduleStopAt: scheduleEndAt,
    }).then((results) => {
        const campaign = results[0] || {};
        return sendCampaignCreatedEmail({
            subject: '[Urgent Request] User Created a Campaign',
            toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
        }, {
            userId,
            campaignDetails: {
                ...campaign,
            },
        }).then(() => res.status(201).send({
            created: 1,
            campaigns: results,
        })).catch((err) => handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' }));
    });
};

export {
    createCampaign,
};
