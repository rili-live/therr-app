import logSpan from 'therr-js-utilities/log-or-update-span';
import { getSearchQueryArgs, getSearchQueryString } from 'therr-js-utilities/http';
import {
    AccessLevels, CampaignAdGoals, CampaignAssetTypes, CampaignStatuses, ErrorCodes, OAuthIntegrationProviders,
} from 'therr-js-utilities/constants';
import sendCampaignCreatedEmail from '../api/email/admin/sendCampaignCreatedEmail';
import sendCampaignPendingReviewEmail from '../api/email/for-business/sendCampaignPendingReviewEmail';
import Store from '../store';
import translate from '../utilities/translator';
import { createUpdateAssetIntegrations, createUpdateCampaignIntegrations } from './helpers/campaignIntegrations';
import { getUserOrgsIdsFromHeaders } from './helpers/user';
import decryptIntegrationsAccess from '../utilities/decryptIntegrationsAccess';
import handleHttpError from '../utilities/handleHttpError';

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

        return Store.campaignAdGroups.get({ campaignId: campaign.id }).then((campaignAdGroups) => {
            const adGroupsPromises = campaignAdGroups.map((adGroup) => Store.campaignAssets.getByIds(adGroup.assetIds || []).then((assets) => ({
                ...adGroup,
                assets,
            })).catch((err) => {
                logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: [`failed to fetch campaign assets for adGroup ID, ${adGroup.id}`],
                    traceArgs: {
                        'error.message': err?.message,
                        'error.response': err?.response?.data,
                    },
                });
                return {
                    ...adGroup,
                    assets: [],
                };
            }));

            return Promise.all(adGroupsPromises).then((adGroups) => {
                campaign.adGroups = adGroups;

                return res.status(200).send(campaign);
            });
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
        spaceId,
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
        adGroups,
        mediaAssest,
    } = req.body;

    const storedStatus = status === CampaignStatuses.PAUSED || status === CampaignStatuses.REMOVED ? status : CampaignStatuses.PENDING;

    return Store.campaigns.createCampaign({
        creatorId: userId,
        organizationId, // TODO
        spaceId,
        title,
        description,
        type,
        status: storedStatus,
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

        // Creates a default adGroup if none are supplied during campaign creation
        const adGroupsPromise = adGroups?.length ? Store.campaignAdGroups.create(adGroups.map((adGroup) => ({
            campaignId: campaign.id,
            creatorId: userId,
            organizationId: campaign.organizationId,
            spaceId: adGroup.spaceId || spaceId, // TODO
            status: storedStatus, // TODO
            headline: adGroup.headline,
            description: adGroup.description,
            performance: 'learning', // TODO
            goal: adGroup.goal || CampaignAdGoals.CLICKS,
            scheduleStartAt,
            scheduleStopAt,
        }))) : Store.campaignAdGroups.create([{
            campaignId: campaign.id,
            creatorId: userId,
            organizationId: campaign.organizationId,
            spaceId, // TODO
            status: storedStatus, // TODO
            headline: 'Default Headline',
            description: 'The default ad group for this campaign',
            performance: 'learning', // TODO
            goal: CampaignAdGoals.CLICKS,
            scheduleStartAt,
            scheduleStopAt,
        }]);

        return adGroupsPromise.then((campaignAdGroups) => {
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
            return [{
                ...campaign,
                adGroups: campaignAdGroups,
            }];
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
        spaceId,
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
        adGroups,
    } = req.body;

    const storedStatus = status === CampaignStatuses.PAUSED || status === CampaignStatuses.REMOVED || !status
        ? status
        : CampaignStatuses.PENDING;

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

            const integrationDetailsEntries = Object.entries(integrationDetails as { [key: string]: any; });

            return createUpdateCampaignIntegrations(req.body, integrationsAccess).then((campaignIntegResults) => {
                const modifiedIntegrationDetails = {
                    ...integrationDetails,
                };
                integrationDetailsEntries.forEach(([target, details], index) => {
                    if (campaignIntegResults[index].status === 'fulfilled') {
                        const campaignId = (campaignIntegResults[index] as any).value.id;
                        if (modifiedIntegrationDetails[target] && campaignId) {
                            // If campaignId is 'missing' remove the link from Therr to integration provider by marking it undefined
                            modifiedIntegrationDetails[target].campaignId = campaignId === 'missing' ? undefined : campaignId;
                        }
                    }
                });
                return createUpdateAssetIntegrations(req.body, integrationsAccess, modifiedIntegrationDetails)
                    .then((adSetResults) => {
                        const adGroupsWithIntegs = [
                            ...adGroups,
                        ];
                        // Merge all results with the updated adGroup.integrationAssociations
                        adSetResults.forEach((adSetResult) => {
                            if (adSetResult.status === 'fulfilled') {
                                adSetResult.value.forEach((adGroupResult, resultIdx) => {
                                    // eslint-disable-next-line no-param-reassign
                                    adGroupsWithIntegs[resultIdx] = {
                                        ...adGroupsWithIntegs[resultIdx],
                                        ...(adGroupResult[resultIdx] || {}),
                                    };
                                });
                            } else if (adSetResult.status === 'rejected') {
                                console.error(JSON.stringify(adSetResult));
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
                            spaceId,
                            title,
                            description,
                            type,
                            status: storedStatus,
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

                            const assetPromises = adGroupsWithIntegs?.map((adGroup) => {
                                const promises: Promise<any[]>[] = [];

                                if (adGroup.assets?.length) {
                                    const newAssets: any = [];
                                    const existingAssets: any = [];
                                    adGroup.assets.forEach((asset) => {
                                        if (asset.id) {
                                            existingAssets.push(asset);
                                        } else {
                                            newAssets.push(asset);
                                        }
                                    });
                                    promises.push(
                                        newAssets.length
                                            ? Store.campaignAssets.create(newAssets.map((asset) => ({
                                                ...asset,
                                                creatorId: userId,
                                                status: storedStatus,
                                                performance: 'learning', // TODO
                                                goal: CampaignAdGoals.CLICKS,
                                                // TODO: Add asset integrationAssociations
                                            })))
                                            : Promise.resolve([]),
                                    );
                                    promises.push(
                                        Promise.all(existingAssets.map((asset) => Store.campaignAssets.update(asset.id, {
                                            ...asset,
                                            // TODO: Add asset integrationAssociations
                                        }))),
                                    );
                                }

                                return Promise.all(promises);
                            });

                            return Promise.all(assetPromises).then((assetPromiseResults) => {
                                const existingAdGroups: any = [];
                                const newAdGroups: any = [];
                                adGroupsWithIntegs?.forEach((adGroup, adGroupIndex) => {
                                    const [createdAssets, [updatedAssets]] = assetPromiseResults[adGroupIndex];

                                    if (adGroup.id) {
                                        existingAdGroups.push({
                                            ...adGroup,
                                            assetIds: [...(createdAssets || []).map((a) => a.id), ...(updatedAssets || []).map((a) => a.id)],
                                        });
                                    } else {
                                        newAdGroups.push({
                                            ...adGroup,
                                            assetIds: [...(createdAssets || []).map((a) => a.id), ...(updatedAssets || []).map((a) => a.id)],
                                        });
                                    }
                                });
                                const adGroupPromises = [
                                    newAdGroups?.length ? Store.campaignAdGroups.create(newAdGroups.map((adGroup) => ({
                                        campaignId: fetchedCampaign.id,
                                        creatorId: userId,
                                        organizationId: fetchedCampaign.organizationId,
                                        spaceId: adGroup.spaceId || spaceId, // TODO
                                        status: storedStatus,
                                        headline: adGroup.headline,
                                        description: adGroup.description,
                                        integrationAssociations: adGroup.integrationAssociations,
                                        performance: 'learning', // TODO
                                        goal: CampaignAdGoals.CLICKS,
                                        scheduleStartAt,
                                        scheduleStopAt,
                                        assetIds: adGroup.assetIds,
                                    }))) : Promise.resolve([]),
                                    // TODO: Consider using transactions
                                    existingAdGroups.length ? Promise.all(existingAdGroups.map((adGroup) => Store.campaignAdGroups.update(adGroup.id, {
                                        campaignId: fetchedCampaign.id,
                                        organizationId: fetchedCampaign.organizationId,
                                        headline: adGroup.headline,
                                        description: adGroup.description,
                                        integrationAssociations: adGroup.integrationAssociations,
                                        // NOTE: This relies on all new and existing assetsIds being including in each adGroup update
                                        assetIds: adGroup.assetIds,
                                    }))) : Promise.resolve([[]]),
                                ];

                                return Promise.all(adGroupPromises)
                                    .then(([createdAdGroups, [updatedAdGroups]]) => {
                                        const mapAssetsToAdGroup = (a, adGroupIndex) => {
                                            const [createdAssets, [updatedAssets]] = assetPromiseResults[adGroupIndex];
                                            return {
                                                ...a,
                                                assets: [...(createdAssets || []), ...(updatedAssets || [])], // TODO: Fix confusing code
                                            };
                                        };
                                        const createdAdGroupsWithAssetResults = createdAdGroups.map(mapAssetsToAdGroup);
                                        const updatedAdGroupsWithAssetResults = updatedAdGroups.map(mapAssetsToAdGroup);
                                        const allAdGroups = createdAdGroupsWithAssetResults.concat(updatedAdGroupsWithAssetResults);
                                        return [{
                                            ...campaign,
                                            adGroups: allAdGroups,
                                        }];
                                    }).then((campaigns) => res.status(200).send({
                                        updated: 1,
                                        campaigns,
                                    }));
                            });
                        }).catch((err) => handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' }));
                    });
            });
        });
};

export {
    createCampaign,
    searchMyCampaigns,
    getCampaign,
    updateCampaign,
};
