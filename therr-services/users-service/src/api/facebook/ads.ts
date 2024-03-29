import axios from 'axios';
import { CampaignAdGoals, CampaignStatuses, CampaignTypes } from 'therr-js-utilities/constants';
import { passthroughAndLogErrors, sanitizeMaxBudget } from './utils';

const assetGoalToOptimizationMap = {
    [CampaignAdGoals.CLICKS]: 'LINK_CLICKS',
    [CampaignAdGoals.ENGAGEMENT]: 'PAGE_LIKES',
    [CampaignAdGoals.IMPRESSIONS]: 'IMPRESSIONS',
    [CampaignAdGoals.LIKES]: 'POST_ENGAGEMENT',
    [CampaignAdGoals.REACH]: 'REACH',
};

// enum {APP_INSTALLS, CLICKS, IMPRESSIONS, LINK_CLICKS, NONE, OFFER_CLAIMS, PAGE_LIKES, POST_ENGAGEMENT, THRUPLAY, PURCHASE, LISTING_INTERACTION}
const campaignTypeToBillingEventMap = {
    [CampaignTypes.AWARENESS]: 'IMPRESSIONS',
    [CampaignTypes.ACQUISITION]: 'LINK_CLICKS',
    [CampaignTypes.ENGAGEMENT]: 'PAGE_LIKES',
    [CampaignTypes.LOCAL]: 'IMPRESSIONS',
    [CampaignTypes.LEADS]: 'LINK_CLICKS',
    [CampaignTypes.SALES]: 'LINK_CLICKS',
};

const getStatusForIntegrationAd = (campaignStatus?: CampaignStatuses, isAdmin = false) => {
    if (campaignStatus === CampaignStatuses.PAUSED || !campaignStatus) {
        return 'PAUSED'; // TODO
    }

    if (campaignStatus === CampaignStatuses.REMOVED) {
        return 'PAUSED';
    }

    if (isAdmin && campaignStatus === CampaignStatuses.ACTIVE) {
        return 'ACTIVE';
    }

    return 'PAUSED';
};

const getCountriesForTargetLocations = (targetLocations) => {
    let countries: string[] = [];
    // TODO: Dynamically set countries if locations are generic (ie. parse label='United States')
    if (!targetLocations?.length) {
        countries = ['US', 'CA'];
    }
    return countries;
};

/**
 * Creates an ad set
 */
const createAdSet = (
    context: {
        accessToken: string;
        adAccountId: string;
        pageId: string;
    },
    adSet: {
        name: string;
        goal: CampaignAdGoals;
        status?: CampaignStatuses;
    },
    campaign: {
        id: string;
        type: CampaignTypes;
        scheduleStopAt: string;
        maxBudget?: number;
        targetLocations?: {
            label: string;
            latitude: number;
            longitude: number;
        }[];
    },
) => {
    const targeting: any = {
        geo_locations: {
            countries: ['US', 'CA'],
            // TODO: Use target locations from campaign inputs
        },
    };

    if (campaign.targetLocations) {
        targeting.geo_locations.countries = getCountriesForTargetLocations(campaign.targetLocations);
        targeting.geo_locations.custom_locations = [];
        campaign.targetLocations.forEach((location) => {
            targeting.geo_locations.custom_locations.push({
                address_string: location.label,
                latitude: location.latitude,
                longitude: location.longitude,
                radius: 50,
                distance_unit: 'mile',
            });
        });
    }
    return axios({
        method: 'post',
        // eslint-disable-next-line max-len
        url: `https://graph.facebook.com/v18.0/${context.adAccountId}/adsets?fields=status&access_token=${context.accessToken}`,
        params: {
            campaign_id: campaign.id,
            name: `[automated] ${adSet.name}`,
            status: getStatusForIntegrationAd(adSet.status),
            // lifetime_budget: sanitizeMaxBudget(campaign.maxBudget), // Can only set campaign budget or adSet budget (not both)
            optimization_goal: assetGoalToOptimizationMap[adSet.goal],
            billing_event: campaignTypeToBillingEventMap[campaign.type],
            bid_amount: 100,
            // enum {LOWEST_COST_WITHOUT_CAP, LOWEST_COST_WITH_BID_CAP, COST_CAP}
            bid_strategy: 'LOWEST_COST_WITH_BID_CAP',
            targeting,
            end_time: campaign.scheduleStopAt,
        },
    }).catch((err) => ({
        data: {
            errors: err.response?.data?.error,
        },
    })).then(passthroughAndLogErrors);
};

/**
 * Updates an ad set
 */
const updateAdSet = (
    context: {
        accessToken: string;
        adAccountId: string;
        pageId: string;
    },
    adSet: {
        id: string;
        name?: string;
        goal?: CampaignAdGoals;
        status?: CampaignStatuses;
    },
    campaign?: {
        scheduleStopAt?: string;
        targetLocations?: {
            label: string;
            latitude: number;
            longitude: number;
        }[];
    },
    isAdmin = false,
) => {
    const params: any = {};

    if (adSet.name) {
        params.name = `[automated] ${adSet.name}`;
    }

    if (adSet.status) {
        params.status = getStatusForIntegrationAd(adSet.status, isAdmin);
    }

    if (campaign?.scheduleStopAt) {
        params.end_time = campaign.scheduleStopAt;
    }

    if (campaign?.targetLocations) {
        params.targeting = {
            // TODO: Dynamically set countries if locations are generic (ie. parse label='United States')
            geo_locations: {
                countries: getCountriesForTargetLocations(campaign?.targetLocations),
                custom_locations: [],
            },
        };
        campaign.targetLocations.forEach((location) => {
            params.targeting.geo_locations.custom_locations.push({
                address_string: location.label,
                latitude: location.latitude,
                longitude: location.longitude,
                radius: 50,
                distance_unit: 'mile',
            });
        });
    }

    return axios({
        method: 'post',
        // eslint-disable-next-line max-len
        url: `https://graph.facebook.com/v18.0/${adSet.id}?fields=id,status&access_token=${context.accessToken}`,
        params,
    }).catch((err) => ({
        data: {
            errors: err.response?.data?.error,
        },
    })).then(passthroughAndLogErrors);
};

/**
 * Creates an ad
 */
const createAd = (
    context: {
        accessToken: string;
        adAccountId: string;
        pageId: string;
        igPageId?: string;
    },
    ad: {
        name: string;
        status?: CampaignStatuses;
        linkUrl?: string;
        headline?: string;
    },
    adSet: {
        id: string;
        linkUrl?: string;
        headline?: string;
    },
    isAdmin = false,
) => {
    if (!ad.linkUrl && !adSet.linkUrl) {
        console.error('Missing Link URL');
        return Promise.resolve({
            data: {},
        });
    }
    if (!adSet.id) {
        console.error('Missing adSet ID');
        return Promise.resolve({
            data: {},
        });
    }
    return axios({
        method: 'post',
        // eslint-disable-next-line max-len
        url: `https://graph.facebook.com/v18.0/${context.adAccountId}/ads?fields=id,status&access_token=${context.accessToken}`,
        params: {
            adset_id: adSet.id,
            name: `[automated] ${ad.name}`,
            status: getStatusForIntegrationAd(ad.status),
            creative: {
                object_story_spec: {
                    page_id: context.pageId,
                    instagram_actor_id: context.igPageId,
                    link_data: {
                        link: ad.linkUrl || adSet.linkUrl,
                        message: ad.headline || adSet.headline,
                    },
                },
                degrees_of_freedom_spec: {
                    creative_features_spec: {
                        standard_enhancements: {
                            enroll_status: 'OPT_IN',
                        },
                    },
                },
            },
        },
    }).catch((err) => ({
        data: {
            errors: err.response?.data?.error,
        },
    })).then(passthroughAndLogErrors);
};

/**
 * Updates an ad
 */
const updateAd = (
    context: {
        accessToken: string;
        adAccountId: string;
        pageId: string;
    },
    ad: {
        id: string;
        name: string;
        status?: CampaignStatuses;
        linkUrl?: string;
        headline?: string;
    },
    adSet: {
        id: string;
        linkUrl?: string;
        headline?: string;
    },
    isAdmin = false,
) => axios({
    method: 'post',
    // eslint-disable-next-line max-len
    url: `https://graph.facebook.com/v18.0/${ad.id}?fields=id,status&access_token=${context.accessToken}`,
    params: {
        name: `[automated] ${ad.name}`,
        status: getStatusForIntegrationAd(ad.status, isAdmin),
        // creative: {
        //     object_story_spec: {
        //         page_id: context.pageId,
        //         // instagram_actor_id: context.igPageId,
        //         link_data: {
        //             link: ad.linkUrl || adSet.linkUrl,
        //             message: ad.headline || adSet.headline,
        //         },
        //     },
        //     degrees_of_freedom_spec: {
        //         creative_features_spec: {
        //             standard_enhancements: {
        //                 enroll_status: 'OPT_IN',
        //             },
        //         },
        //     },
        // },
    },
}).catch((err) => ({
    data: {
        errors: err.response?.data?.error,
    },
})).then(passthroughAndLogErrors);

export {
    createAdSet,
    updateAdSet,
    createAd,
    updateAd,
};
