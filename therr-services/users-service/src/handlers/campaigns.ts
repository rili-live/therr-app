import {
    AccessLevels, CampaignStatuses, ErrorCodes, OAuthIntegrationProviders,
} from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { getSearchQueryArgs, getSearchQueryString } from 'therr-js-utilities/http';
import decryptIntegrationsAccess from '../utilities/decryptIntegrationsAccess';
import handleHttpError from '../utilities/handleHttpError';
import translate from '../utilities/translator';
import Store from '../store';
import sendCampaignCreatedEmail from '../api/email/admin/sendCampaignCreatedEmail';
import sendCampaignPendingReviewEmail from '../api/email/for-business/sendCampaignPendingReviewEmail';
import { getUserOrgsIdsFromHeaders } from './helpers/user';
import * as facebook from '../api/facebook';

const isAdsProviderAuthenticated = (userIntegrationsAccess: {
    [key: string]: any;
}, target: string) => {
    // TODO: Refresh token if almost expired
    const combinedTarget = target === OAuthIntegrationProviders.INSTAGRAM
        ? OAuthIntegrationProviders.FACEBOOK
        : target;

    return userIntegrationsAccess[combinedTarget]?.user_access_token
        && userIntegrationsAccess[combinedTarget]?.user_access_token_expires_at
        && userIntegrationsAccess[combinedTarget].user_access_token_expires_at > Date.now();
};

// READ
const getCampaign = async (req, res) => {
    const userId = req.headers['x-userid'];
    const readAccessOrgIds = getUserOrgsIdsFromHeaders(req.headers, 'read');

    return Store.campaigns.getCampaigns({
        id: req.params.id,
    }, {
        creatorId: userId,
        userOrganizations: readAccessOrgIds,
    }).then((campaigns) => {
        const campaign = campaigns[0] || {};

        const assetsPromise = campaign?.assetIds?.length
            ? Store.campaignAssets.get({}, campaign.assetIds) : Promise.resolve([]);

        return assetsPromise.then((campaignAssets) => {
            campaign.assets = campaignAssets;
            return res.status(200).send(campaign);
        });
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
    const readAccessOrgIds = getUserOrgsIdsFromHeaders(req.headers, 'read');

    return Store.campaigns.searchCampaigns(searchArgs[0], searchArgs[1], userId, {
        userOrganizations: readAccessOrgIds,
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
};

// SAVE
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
        integrationDetails,
        scheduleStartAt,
        scheduleStopAt,
        assets,
    } = req.body;

    return Store.campaigns.createCampaign({
        creatorId: userId,
        organizationId, // TODO
        assetIds, // TODO
        businessSpaceIds, // TODO
        title,
        description,
        type,
        status: status === CampaignStatuses.PAUSED || status === CampaignStatuses.REMOVED ? status : CampaignStatuses.PENDING,
        targetDailyBudget: targetDailyBudget || 0, // TODO
        costBiddingStrategy: costBiddingStrategy || 'default',
        targetLanguages: targetLanguages || [locale],
        targetLocations,
        integrationTargets,
        integrationDetails,
        scheduleStartAt,
        scheduleStopAt,
    }).then((results) => {
        const campaign = results[0] || {};

        const assetsPromise = assets?.length ? Store.campaignAssets.create(assets.map((asset) => ({
            creatorId: userId,
            organizationId: campaign.organizationId,
            media: asset.media,
            spaceId: asset.spaceId, // TODO
            status: 'accepted',
            type: asset.type,
            headline: asset.headline,
            longText: asset.longText,
            performance: 'learning', // TODO
        }))) : Promise.resolve([]);

        return assetsPromise.then((campaignAssets) => {
            // Fire off request to create integrations (on third party platforms)
            sendCampaignCreatedEmail({
                subject: '[Urgent Request] User Created a Campaign',
                toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
            }, {
                userId,
                campaignDetails: {
                    ...campaign,
                },
            });
            return Store.campaigns.updateCampaign({
                id: campaign.id,
            }, {
                assetIds: campaignAssets.map((asset) => asset.id),
            });
        }).then((campaigns) => res.status(201).send({
            created: results.length,
            campaigns,
        }));
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' }));
};

const updateCampaign = async (req, res) => {
    const userId = req.headers['x-userid'];
    const authorization = req.headers.authorization;
    const locale = req.headers['x-localecode'] || 'en-us';
    const writeAccessOrgIds = getUserOrgsIdsFromHeaders(req.headers, 'write');

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
        integrationDetails,
        scheduleStartAt,
        scheduleStopAt,
        assets,
    } = req.body;

    // Get campaign, check it exists, and check current status
    return Store.users.getUserById(userId, ['email', 'integrationsAccess'])
        .then(([user]) => Store.campaigns.getCampaigns({
            id: req.params.id,
        }, {
            creatorId: userId,
            userOrganizations: writeAccessOrgIds,
        }).then(([fetchedCampaign]) => [user, fetchedCampaign]))
        .then(([user, fetchedCampaign]) => {
            if (!fetchedCampaign) {
                return handleHttpError({
                    res,
                    message: 'Campaign not found',
                    statusCode: 404,
                });
            }

            const integrationsAccess = decryptIntegrationsAccess(user.integrationsAccess);
            const integrationUpdatePromises: Promise<{ id?: string; }>[] = [];

            integrationTargets.forEach((target) => {
                if (target === OAuthIntegrationProviders.FACEBOOK
                    && isAdsProviderAuthenticated(integrationsAccess, target)
                    && integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.adAccountId) {
                    const promise = (integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.campaignId
                        ? facebook.updateCampaign(
                            integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.adAccountId,
                            integrationsAccess[OAuthIntegrationProviders.FACEBOOK]?.user_access_token,
                            {
                                id: integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.campaignId,
                                title,
                                maxBudget: integrationDetails[OAuthIntegrationProviders.FACEBOOK].maxBudget || undefined,
                            },
                        )
                        : facebook.createCampaign(
                            integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.adAccountId,
                            integrationsAccess[OAuthIntegrationProviders.FACEBOOK]?.user_access_token,
                            {
                                title,
                                type,
                                maxBudget: integrationDetails[OAuthIntegrationProviders.FACEBOOK].maxBudget || undefined,
                            },
                        ))
                        .then((response) => {
                            if (response?.data?.configured_status === 'ARCHIVED' || response?.data?.configured_status === 'DELETED') {
                                // If user deleted campaign from integration provider, create a new one
                                return facebook.createCampaign(
                                    integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.adAccountId,
                                    integrationsAccess[OAuthIntegrationProviders.FACEBOOK]?.user_access_token,
                                    {
                                        title,
                                        type,
                                        maxBudget: integrationDetails[OAuthIntegrationProviders.FACEBOOK].maxBudget || undefined,
                                    },
                                ).then((subResponse) => ({
                                    id: subResponse.data?.id,
                                }));
                            }
                            if (response?.data?.errors) {
                                logSpan({
                                    level: 'error',
                                    messageOrigin: 'API_SERVER',
                                    messages: ['api error'],
                                    traceArgs: {
                                        'error.message': response?.data?.errors?.message,
                                        'error.code': response?.data?.errors?.code,
                                        'error.subcode': response?.data?.errors?.error_subcode,
                                        integration: OAuthIntegrationProviders.FACEBOOK,
                                        integration_trace_id: response?.data?.errors?.fbtrace_id,
                                    },
                                });
                            }
                            return ({
                                id: response.data?.id || integrationDetails[OAuthIntegrationProviders.FACEBOOK]?.campaignId,
                            });
                        }).catch((error) => {
                            // TODO: Email Admin
                            console.log(error);
                            return {
                                id: 'missing',
                            };
                        });

                    integrationUpdatePromises.push(promise);
                } else {
                    integrationUpdatePromises.push(Promise.resolve({}));
                }
            });

            return Promise.allSettled(integrationUpdatePromises).then((results) => {
                const modifiedIntegrationDetails = {
                    ...integrationDetails,
                };
                integrationTargets.forEach((target, index) => {
                    if (results[index].status === 'fulfilled') {
                        const campaignId = (results[index] as any).value.id;
                        if (modifiedIntegrationDetails[target] && campaignId) {
                            modifiedIntegrationDetails[target].campaignId = campaignId === 'missing' ? undefined : campaignId;
                        }
                    }
                });

                const shouldSendEmailNotifications = (status === CampaignStatuses.REMOVED && fetchedCampaign.status !== CampaignStatuses.REMOVED)
                || (status === CampaignStatuses.ACTIVE && fetchedCampaign.status !== CampaignStatuses.ACTIVE);
                const isCampaignCompleted = Date.now() >= new Date(scheduleStopAt || fetchedCampaign.scheduleStopAt).getTime();
                const isCampaignBeforeSchedule = Date.now() < new Date(scheduleStartAt || scheduleStopAt.scheduleStartAt).getTime();
                let generalizedStatus = isCampaignCompleted && (status || fetchedCampaign.status) !== CampaignStatuses.REMOVED
                    ? CampaignStatuses.COMPLETE
                    : (status || fetchedCampaign.status);
                generalizedStatus = isCampaignBeforeSchedule && (status || fetchedCampaign.status) !== CampaignStatuses.REMOVED
                    ? CampaignStatuses.PENDING
                    : generalizedStatus;

                return Store.campaigns.updateCampaign({
                    id: req.params.id,
                }, {
                    organizationId, // TODO
                    assetIds, // TODO
                    businessSpaceIds, // TODO
                    title,
                    description,
                    type,
                    status: status === CampaignStatuses.PAUSED || status === CampaignStatuses.REMOVED || !status
                        ? status
                        : CampaignStatuses.PENDING,
                    targetDailyBudget, // TODO
                    costBiddingStrategy,
                    targetLanguages,
                    targetLocations,
                    integrationTargets,
                    integrationDetails: modifiedIntegrationDetails,
                    scheduleStartAt,
                    scheduleStopAt,
                }).then(([campaign]) => {
                    if (shouldSendEmailNotifications) {
                        if (generalizedStatus !== CampaignStatuses.REMOVED) {
                            sendCampaignPendingReviewEmail({
                                subject: `Campaign in Review | ${title}`,
                                toAddresses: [user.email],
                            }, {
                                campaignName: title,
                                isPastSchedule: isCampaignCompleted,
                                isBeforeSchedule: isCampaignBeforeSchedule,
                            });
                            // TODO: Send email for campaign removal
                        }
                        // TODO: Automate and remove notification email
                        // Fire off request to update integrations (on third party platforms)
                        sendCampaignCreatedEmail({
                            subject: '[Urgent Request] User Updated a Campaign',
                            toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                        }, {
                            userId,
                            campaignDetails: {
                                ...campaign,
                            },
                        });
                    }
                    const existingAssets: any = [];
                    const newAssets: any = [];
                    assets?.forEach((asset) => {
                        if (asset.id) {
                            existingAssets.push(asset);
                        } else {
                            newAssets.push(asset);
                        }
                    });
                    const assetPromises = [
                        newAssets?.length ? Store.campaignAssets.create(newAssets.map((asset) => ({
                            creatorId: userId,
                            organizationId: campaign.organizationId,
                            media: asset.media,
                            spaceId: asset.spaceId, // TODO
                            status: 'accepted',
                            type: asset.type,
                            headline: asset.headline,
                            longText: asset.longText,
                            performance: 'learning', // TODO
                        }))) : Promise.resolve([]),
                        // TODO: Consider using transactions
                        existingAssets.length ? Promise.all(existingAssets.map((asset) => Store.campaignAssets.update(asset.id, {
                            organizationId: campaign.organizationId,
                            headline: asset.headline,
                            longText: asset.longText,
                        }))) : Promise.resolve([]),
                    ];

                    return Promise.all(assetPromises).then(([newCampaignAssets, updatedCampaignAssets]) => Store.campaigns.updateCampaign({
                        id: req.params.id,
                    }, {
                        assetIds: newCampaignAssets.map((asset) => asset.id).concat(campaign.assetIds),
                    })).then((campaigns) => res.status(200).send({
                        updated: 1,
                        campaigns,
                    }));
                }).catch((err) => handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' }));
            });
        });
};

export {
    createCampaign,
    searchMyCampaigns,
    getCampaign,
    updateCampaign,
};
