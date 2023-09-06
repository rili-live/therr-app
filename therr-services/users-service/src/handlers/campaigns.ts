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

    return sendCampaignCreatedEmail({
        subject: '[Urgent Request] User Created a Campaign',
        toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
    }, {
        userId,
        campaignDetails: {
            ...req.body,
        },
    }).then(() => res.status(201).send({
        created: 1,
    })).catch((err) => handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' }));
};

export {
    createCampaign,
};
