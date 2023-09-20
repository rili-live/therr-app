import { AccessLevels, ErrorCodes } from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { getSearchQueryArgs, getSearchQueryString } from 'therr-js-utilities/http';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import Store from '../store';
import userMetricsService from '../api/userMetricsService';
import sendCampaignCreatedEmail from '../api/email/admin/sendCampaignCreatedEmail';

// READ
const getCampaign = async (req, res) => {
    const userId = req.headers['x-userid'];

    return Store.userOrganizations.get({
        userId,
    }).then((userOrgs) => {
        const orgsWithReadAccess = userOrgs.filter((org) => (
            org.accessLevels.includes(AccessLevels.ORGANIZATIONS_ADMIN)
            || org.accessLevels.includes(AccessLevels.ORGANIZATIONS_BILLING)
            || org.accessLevels.includes(AccessLevels.ORGANIZATIONS_MANAGER)
            || org.accessLevels.includes(AccessLevels.ORGANIZATIONS_READ)
        ));

        return Store.campaigns.getCampaigns({
            id: req.params.id,
        }, {
            creatorId: userId,
            userOrganizations: orgsWithReadAccess.map((org) => org.organizationId),
        }).then((campaigns) => res.status(200).send(campaigns[0] || {}));
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' }));
};

const searchMyCampaigns = async (req, res) => {
    const userId = req.headers['x-userid'];
    const {
        // filterBy,
        itemsPerPage,
        pageNumber,
    } = req.query;
    const authorization = req.headers.authorization;
    const locale = req.headers['x-localecode'] || 'en-us';

    const integerColumns = [];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);

    return Store.userOrganizations.get({
        userId,
    }).then((userOrgs) => {
        const orgsWithReadAccess = userOrgs.filter((org) => (
            org.accessLevels.includes(AccessLevels.ORGANIZATIONS_ADMIN)
            || org.accessLevels.includes(AccessLevels.ORGANIZATIONS_BILLING)
            || org.accessLevels.includes(AccessLevels.ORGANIZATIONS_MANAGER)
            || org.accessLevels.includes(AccessLevels.ORGANIZATIONS_READ)
        ));

        return Store.campaigns.searchCampaigns(searchArgs[0], searchArgs[1], userId, {
            userOrganizations: orgsWithReadAccess.map((org) => org.organizationId),
        }).then((results) => {
            const response = {
                results,
                pagination: {
                    itemsPerPage: Number(itemsPerPage),
                    pageNumber: Number(pageNumber),
                },
            };
            return res.status(200).send(response);
        }).catch((err) => handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' }));
    });
};

// CREATE
const createCampaign = async (req, res) => {
    const userId = req.headers['x-userid'];
    const authorization = req.headers.authorization;
    const locale = req.headers['x-localecode'] || 'en-us';

    const {
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
        integrationTargets,
        scheduleStartAt,
        scheduleStopAt,
    } = req.body;

    return Store.campaigns.createCampaign({
        creatorId: userId,
        organizationId, // TODO
        assetIds, // TODO
        businessSpaceIds, // TODO
        title,
        description,
        type,
        status: status || 'active',
        targetDailyBudget: targetDailyBudget || 0, // TODO
        costBiddingStrategy: costBiddingStrategy || 'default',
        targetLanguages: targetLanguages || [locale],
        targetLocations,
        integrationTargets, // TODO
        scheduleStartAt,
        scheduleStopAt,
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
    searchMyCampaigns,
    getCampaign,
};
