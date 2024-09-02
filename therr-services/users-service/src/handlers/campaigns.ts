import logSpan from 'therr-js-utilities/log-or-update-span';
import { getSearchQueryArgs, getSearchQueryString, parseHeaders } from 'therr-js-utilities/http';
import {
    AccessLevels, CampaignAdGoals, CampaignAssetTypes, CampaignStatuses, CampaignTypes, ErrorCodes, OAuthIntegrationProviders,
} from 'therr-js-utilities/constants';
import sendCampaignCreatedEmail from '../api/email/admin/sendCampaignCreatedEmail';
import sendCampaignPendingReviewEmail from '../api/email/for-business/sendCampaignPendingReviewEmail';
import Store from '../store';
import translate from '../utilities/translator';
import { createUpdateAssetIntegrations, createUpdateCampaignIntegrations } from './helpers/campaignIntegrations';
import { getUserOrgsIdsFromHeaders, redactUserCreds } from './helpers/user';
import decryptIntegrationsAccess from '../utilities/decryptIntegrationsAccess';
import handleHttpError from '../utilities/handleHttpError';
import sendCampaignApprovedEmail from '../api/email/for-business/sendCampaignApprovedEmail';

const campaignTypeToAdGroupGoalMap = {
    [CampaignTypes.AWARENESS]: CampaignAdGoals.IMPRESSIONS, // or REACH
    [CampaignTypes.ACQUISITION]: CampaignAdGoals.CLICKS, // or REACH or IMPRESSIONS
    [CampaignTypes.ENGAGEMENT]: CampaignAdGoals.ENGAGEMENT, // or LIKES
    [CampaignTypes.LOCAL]: CampaignAdGoals.IMPRESSIONS, // or IMPRESSIONS
    [CampaignTypes.LEADS]: CampaignAdGoals.CLICKS, // or LEAD_GENERATION
    [CampaignTypes.SALES]: CampaignAdGoals.CLICKS, // or CONVERSATIONS
};

const accessAndModifyCampaign = (
    context: {
        campaignId: string;
        userActorId: string;
        isAdmin: boolean;
        whiteLabelOrigin: string;
        brandVariation: string;
    },
    campaignReqBody: any,
    effectiveStatus: CampaignStatuses,
    getCampaignPromise: Promise<any[]>,
) => {
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
        assetsToDelete,
    } = campaignReqBody;

    // Get campaign, check it exists, and check current status
    return Store.users.getUserById(context.userActorId, ['id', 'email', 'integrationsAccess'])
        .then(([user]) => getCampaignPromise.then(([fetchedCampaign]) => [user, fetchedCampaign]))
        .then(([user, fetchedCampaign]) => {
            if (!fetchedCampaign) {
                throw new Error('404: Campaign not found');
                // return handleHttpError({
                //     res,
                //     message: 'Campaign not found',
                //     statusCode: 404,
                // });
            }

            if (assetsToDelete?.length) {
                Store.campaignAssets.delete(assetsToDelete.map((a) => a.id))
                    .catch((err) => {
                        logSpan({
                            level: 'error',
                            messageOrigin: 'API_SERVER',
                            messages: [`failed to delete underlying assets, ${JSON.stringify(assetsToDelete)}`],
                            traceArgs: {
                                'error.message': err?.message,
                                'error.response': err?.response?.data,
                            },
                        });
                    });
            }

            let integrationsAccess;
            try {
                integrationsAccess = decryptIntegrationsAccess(user.integrationsAccess);
            } catch (e) {
                throw new Error('403: Unable to decrypt integration access');
            }

            const integrationDetailsEntries = Object.entries(integrationDetails as { [key: string]: any; });

            return createUpdateCampaignIntegrations({
                ...campaignReqBody,
                status: effectiveStatus,
            }, integrationsAccess, context.isAdmin).then((campaignIntegResults) => {
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
                return createUpdateAssetIntegrations({
                    ...campaignReqBody,
                    status: effectiveStatus,
                }, integrationsAccess, modifiedIntegrationDetails, context.isAdmin)
                    .then((adSetResults) => {
                        const adGroupsWithIntegs = [
                            ...adGroups,
                        ];
                        // TODO: Parse Error Messages for User Signalling
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

                        // eslint-disable-next-line max-len
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
                            id: context.campaignId,
                        }, {
                            organizationId, // TODO
                            spaceId,
                            title,
                            description,
                            type,
                            status: effectiveStatus,
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
                                        agencyDomainName: context.whiteLabelOrigin,
                                        brandVariation: context.brandVariation,
                                        recipientIdentifiers: {
                                            id: user.id,
                                            accountEmail: user.email,
                                        },
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
                                    agencyDomainName: context.whiteLabelOrigin,
                                    brandVariation: context.brandVariation,
                                }, {
                                    userId: context.userActorId,
                                    campaignDetails: {
                                        ...campaign,
                                    },
                                });
                            }

                            // TODO: Ensure media asset Ids are returned
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
                                                type: asset.type || CampaignAssetTypes.COMBINED,
                                                creatorId: context.userActorId,
                                                status: effectiveStatus,
                                                performance: 'learning', // TODO
                                                goal: CampaignAdGoals.CLICKS,
                                                // TODO: Add asset integrationAssociations
                                            })))
                                            : Promise.resolve([]),
                                    );
                                    promises.push(
                                        Promise.all(existingAssets.map((asset) => Store.campaignAssets.update(asset.id, {
                                            ...asset,
                                            status: effectiveStatus,
                                            // TODO: Add asset integrationAssociations
                                        }))),
                                    );
                                }

                                return Promise.all(promises);
                            });

                            return (Promise.all(assetPromises)).then((assetPromiseResults) => {
                                const existingAdGroups: any = [];
                                const newAdGroups: any = [];
                                adGroupsWithIntegs?.forEach((adGroup, adGroupIndex) => {
                                    const [createdAssets, updatedAssetsList] = assetPromiseResults[adGroupIndex];
                                    const updatedAssets = updatedAssetsList.flat(1);

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
                                        creatorId: context.userActorId,
                                        organizationId: fetchedCampaign.organizationId,
                                        spaceId: adGroup.spaceId || spaceId, // TODO
                                        status: effectiveStatus,
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
                                        status: effectiveStatus,
                                    }))) : Promise.resolve([[]]),
                                ];

                                return Promise.all(adGroupPromises)
                                    .then(([createdAdGroups, [updatedAdGroups]]) => {
                                        const mapAssetsToAdGroup = (a, adGroupIndex) => {
                                            const [createdAssets, updatedAssetsList] = assetPromiseResults[adGroupIndex];
                                            const updatedAssets = updatedAssetsList.flat(1);
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
                                    });
                            });
                        });
                    });
            });
        });
};

const getCampaignAndAdGroup = (campaignPromise) => campaignPromise.then((campaigns) => {
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

            return campaign;
        });
    });
});

// READ
const getCampaign = async (req, res) => {
    const {
        authorization,
        locale,
        userId,
        userOrgsAccess,
    } = parseHeaders(req.headers);
    const readAccessOrgIds = getUserOrgsIdsFromHeaders(userOrgsAccess, 'read');

    getCampaignAndAdGroup(
        Store.campaigns.getCampaigns({
            id: req.params.id,
        }, {
            creatorId: userId,
            userOrganizations: readAccessOrgIds,
        }),
    )
        .then((campaignExpanded) => res.status(200).send(campaignExpanded))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' }));
};

const searchMyCampaigns = async (req, res) => {
    const userId = req.headers['x-userid'];
    const {
        // filterBy,
        itemsPerPage,
        pageNumber,
    } = req.query;
    const {
        authorization,
        locale,
        userOrgsAccess,
    } = parseHeaders(req.headers);

    const integerColumns = [];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);
    const readAccessOrgIds = getUserOrgsIdsFromHeaders(userOrgsAccess, 'read');

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

const searchAllCampaigns = async (req, res) => {
    const userId = req.headers['x-userid'];
    const {
        itemsPerPage,
        pageNumber,
    } = req.query;
    const authorization = req.headers.authorization;
    const locale = req.headers['x-localecode'] || 'en-us';

    const integerColumns = [];
    const searchArgs = getSearchQueryArgs(req.query, integerColumns);

    return Store.campaigns.searchCampaigns(searchArgs[0], searchArgs[1], undefined).then((results) => {
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
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

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
            goal: adGroup.goal || campaignTypeToAdGroupGoalMap[type],
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
            goal: campaignTypeToAdGroupGoalMap[type],
            scheduleStartAt,
            scheduleStopAt,
        }]);

        return adGroupsPromise.then((campaignAdGroups) => {
            // Fire off request to create integrations (on third party platforms)
            sendCampaignCreatedEmail({
                subject: '[Urgent Request] User Created a Campaign',
                toAddresses: [process.env.AWS_FEEDBACK_EMAIL_ADDRESS as any],
                agencyDomainName: whiteLabelOrigin,
                brandVariation,
            }, {
                userId,
                campaignDetails: {
                    ...campaign,
                },
            });
            return [{
                ...campaign,
                adGroups: campaignAdGroups.map((group) => ({
                    ...group,
                    assets: [],
                })),
            }];
        }).then((campaigns) => res.status(201).send({
            created: results.length,
            campaigns,
        }));
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' }));
};

const updateCampaign = async (req, res) => {
    const {
        authorization,
        locale,
        userId,
        userOrgsAccess,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);
    const writeAccessOrgIds = getUserOrgsIdsFromHeaders(userOrgsAccess, 'write');

    const {
        status,
    } = req.body;

    const storedStatus = status === CampaignStatuses.PAUSED || status === CampaignStatuses.REMOVED || !status
        ? status
        : CampaignStatuses.PENDING;

    return accessAndModifyCampaign(
        {
            campaignId: req.params.id,
            userActorId: userId,
            isAdmin: false,
            whiteLabelOrigin,
            brandVariation,
        },
        req.body,
        storedStatus,
        Store.campaigns.getCampaigns({
            id: req.params.id,
        }, {
            creatorId: userId,
            userOrganizations: writeAccessOrgIds,
        }),
    )
        .then((campaigns) => res.status(200).send({
            updated: 1,
            campaigns,
        }))
        .catch((err) => {
            // TODO: Add more error handling with defined error codes
            if (err?.message?.startsWith('404')) {
                return handleHttpError({
                    res,
                    message: 'Campaign not found',
                    statusCode: 404,
                });
            }
            return handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' });
        });
};

const updateCampaignStatus = async (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
        brandVariation,
    } = parseHeaders(req.headers);

    const {
        creatorId,
        status,
    } = req.body;

    const getCampaignPromise = Store.campaigns.getCampaigns({
        id: req.params.id,
    }, {
        creatorId,
    });

    getCampaignAndAdGroup(getCampaignPromise)
        .then((campaignExpanded) => accessAndModifyCampaign(
            {
                campaignId: req.params.id,
                userActorId: creatorId,
                isAdmin: true,
                whiteLabelOrigin,
                brandVariation,
            },
            campaignExpanded,
            status,
            Promise.resolve([campaignExpanded]),
        ))
        .then((campaigns) => {
            // TODO: Send campaign updated email
            Store.users.getUserById(creatorId)
                .then(([user]) => {
                    redactUserCreds(user);
                    sendCampaignApprovedEmail({
                        subject: 'Campaign Update Approved',
                        toAddresses: [user.email],
                        agencyDomainName: whiteLabelOrigin,
                        brandVariation,
                        recipientIdentifiers: {
                            id: user.id,
                            accountEmail: user.email,
                        },
                    }, {
                        campaignName: campaigns[0].title,
                        integrationTargets: campaigns[0].integrationTargets,
                    });
                });

            return res.status(200).send({
                updated: 1,
                campaigns,
            });
        })
        .catch((err) => {
            // TODO: Add more error handling with defined error codes
            if (err?.message?.startsWith('404')) {
                return handleHttpError({
                    res,
                    message: 'Campaign not found',
                    statusCode: 404,
                });
            }
            return handleHttpError({ err, res, message: 'SQL:USERS_ROUTES:ERROR' });
        });
};

export {
    createCampaign,
    searchMyCampaigns,
    searchAllCampaigns,
    getCampaign,
    updateCampaign,
    updateCampaignStatus,
};
