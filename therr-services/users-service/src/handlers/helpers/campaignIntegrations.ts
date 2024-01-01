import { CampaignAssetTypes, CampaignStatuses, OAuthIntegrationProviders } from 'therr-js-utilities/constants';
import * as facebook from '../../api/facebook';

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

const createUpdateCampaignIntegrations = (campaignRequest, integrationsAccess, isAdmin = false) => {
    const {
        title,
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
    } = campaignRequest;
    const integrationDetailsEntries = Object.entries(integrationDetails as { [key: string]: any; });
    const integrationCampaignPromises: Promise<{ id?: string; }>[] = [];

    integrationDetailsEntries.forEach(([target, details]) => {
        if (target === OAuthIntegrationProviders.FACEBOOK
            && isAdsProviderAuthenticated(integrationsAccess, target)
            && details?.adAccountId
            && details?.pageId) {
            const campaignPromise = (details?.campaignId
                ? facebook.updateCampaign(
                    details?.adAccountId,
                    integrationsAccess[OAuthIntegrationProviders.FACEBOOK]?.user_access_token,
                    {
                        id: details?.campaignId,
                        title,
                        maxBudget: details?.maxBudget || undefined,
                        status: !integrationTargets.includes(target)
                            ? CampaignStatuses.REMOVED
                            : status,
                    },
                    isAdmin,
                )
                : facebook.createCampaign(
                    details?.adAccountId,
                    integrationsAccess[OAuthIntegrationProviders.FACEBOOK]?.user_access_token,
                    {
                        title,
                        type,
                        maxBudget: details.maxBudget || undefined,
                        status: !integrationTargets.includes(target)
                            ? CampaignStatuses.REMOVED
                            : status,
                    },
                ))
                .then((response) => {
                    if (response?.data?.configured_status === 'ARCHIVED' || response?.data?.configured_status === 'DELETED') {
                        // If user deleted campaign from integration provider, create a new one
                        return facebook.createCampaign(
                            details?.adAccountId,
                            integrationsAccess[OAuthIntegrationProviders.FACEBOOK]?.user_access_token,
                            {
                                title,
                                type,
                                maxBudget: details.maxBudget || undefined,
                                status: !integrationTargets.includes(target)
                                    ? CampaignStatuses.REMOVED
                                    : status,
                            },
                        ).then((subResponse) => ({
                            id: subResponse.data?.id,
                        }));
                    }
                    if (response?.data?.errors) {
                        // TODO: Handle various nuanced errors
                    }
                    return ({
                        id: response.data?.id || details?.campaignId,
                    });
                });

            integrationCampaignPromises.push(campaignPromise);
        } else {
            integrationCampaignPromises.push(Promise.resolve({}));
        }
    });

    return Promise.allSettled(integrationCampaignPromises);
};

const createUpdateAssetIntegrations = (campaignRequest, integrationsAccess, latestIntegrationDetails, isAdmin = false) => {
    const {
        adGroups,
        title,
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
        assetsToDelete, // TODO: Remove association with integration
    } = campaignRequest;
    const integrationDetailsEntries = Object.entries(integrationDetails as { [key: string]: any; });
    const integrationAssetPromises: Promise<any[]>[] = [];

    integrationDetailsEntries.forEach(([target, details]) => {
        if (target === OAuthIntegrationProviders.FACEBOOK
            && isAdsProviderAuthenticated(integrationsAccess, target)
            && latestIntegrationDetails[target].campaignId
            && details?.adAccountId
            && details?.pageId) {
            const context = {
                accessToken: integrationsAccess[target].user_access_token,
                adAccountId: integrationDetails[target].adAccountId,
                pageId: integrationDetails[target].pageId,
                igPageId: integrationDetails[OAuthIntegrationProviders.INSTAGRAM]?.pageId,
            };
            // TODO: Account for existingAdGroups by updating adGroups.integrationAssociations
            const adGroupsPromise = Promise.allSettled(adGroups.map((adGroup) => {
                if (!adGroup.id || !adGroup.integrationAssociations[target] || !adGroup.integrationAssociations[target].adSetId) {
                    return facebook.createAdSet(
                        context,
                        {
                            name: adGroup.headline,
                            goal: adGroup.goal,
                            status,
                        },
                        {
                            id: latestIntegrationDetails[target].campaignId,
                            type,
                            scheduleStopAt,
                            maxBudget: details?.maxBudget || undefined,
                            targetLocations,
                        },
                    );
                }

                // TODO: Only update if has changes
                // TODO: Handle edge case where integration was deleted from third party provider
                return facebook.updateAdSet(
                    context,
                    {
                        id: adGroup.integrationAssociations[target].adSetId,
                        name: adGroup.headline,
                        goal: adGroup.goal,
                        status,
                    },
                    {
                        targetLocations,
                    },
                    isAdmin,
                );
            })).then((results) => {
                const updatedAdGroups = results.map((result: any, index) => {
                    const adGroup = adGroups[index];
                    if (result?.status === 'fulfilled' && result?.value?.data?.id) {
                        adGroups[index].integrationAssociations = {
                            ...adGroup.integrationAssociations,
                            [target]: {
                                ...(adGroup.integrationAssociations?.[target] || {}),
                                adSetId: result?.value?.data?.id,
                            },
                        };
                    }

                    // TODO: Parse Error Messages for User Signalling
                    return adGroups[index];
                });
                // TODO: map create result ids to adGroup.integrationAssociations[target].adSetId
                return updatedAdGroups;
            }).then((updatedAdGroups) => {
                // TODO: Use integration bulk endpoints
                const adGroupAssetsPromises = updatedAdGroups.map((adGroup) => Promise.allSettled(adGroup.assets.map((asset) => {
                    const adSetId = adGroup?.integrationAssociations?.[target]?.adSetId;
                    const assetId = asset.integrationAssociations?.[target]?.assetId;

                    if (!adSetId) {
                        return Promise.resolve(asset);
                    }

                    if (asset.type === CampaignAssetTypes.MEDIA) {
                        return Promise.resolve(asset);
                    }

                    const restMethod = !assetId ? facebook.createAd : facebook.updateAd;

                    return restMethod(
                        context,
                        {
                            id: assetId,
                            name: asset.headline,
                            status,
                            linkUrl: asset.linkUrl,
                            headline: asset.headline,
                        },
                        {
                            id: adSetId,
                        },
                        isAdmin,
                    ).then((response) => {
                        if (response?.data?.id) {
                            return {
                                ...asset,
                                integrationAssociations: {
                                    ...(asset.integrationAssociations || {}),
                                    [target]: {
                                        ...(asset.integrationAssociations?.[target] || {}),
                                        assetId: response?.data?.id,
                                    },
                                },
                            };
                        }

                        return asset;
                    });
                })));

                return Promise.all(adGroupAssetsPromises).then((resultsByAdGroup) => {
                    const updatedAdGroupsWithAssets = resultsByAdGroup.map((adGroupAssetsResults: any, index) => {
                        adGroups[index].assets = [];
                        adGroupAssetsResults.forEach((assetResult) => {
                            if (assetResult?.status === 'fulfilled') {
                                adGroups[index].assets.push({ ...(assetResult?.value || {}) });
                            }
                        });

                        // TODO: Parse Error Messages for User Signalling
                        return adGroups[index];
                    });
                    return updatedAdGroupsWithAssets;
                });
            });
            integrationAssetPromises.push(adGroupsPromise);
            integrationAssetPromises.push(Promise.resolve([])); // TODO: Remove after above impl
        } else {
            integrationAssetPromises.push(Promise.resolve([]));
        }
    });

    return Promise.allSettled(integrationAssetPromises);
};

export {
    createUpdateCampaignIntegrations,
    createUpdateAssetIntegrations,
};
