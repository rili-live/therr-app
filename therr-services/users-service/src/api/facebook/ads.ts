import axios from 'axios';
import { CampaignAdGoals, CampaignStatuses, CampaignTypes } from 'therr-js-utilities/constants';
import { passthroughAndLogErrors, sanitizeMaxBudget } from './utils';

// TODO: ...add more mapping logic
const assetGoalToOptimizationMap = {
    [CampaignAdGoals.CLICKS]: 'POST_ENGAGEMENT',
    [CampaignAdGoals.ENGAGEMENT]: 'POST_ENGAGEMENT',
    [CampaignAdGoals.IMPRESSIONS]: 'POST_ENGAGEMENT',
    [CampaignAdGoals.LIKES]: 'POST_ENGAGEMENT',
};

// TODO: ...add more mapping logic
// enum {APP_INSTALLS, CLICKS, IMPRESSIONS, LINK_CLICKS, NONE, OFFER_CLAIMS, PAGE_LIKES, POST_ENGAGEMENT, THRUPLAY, PURCHASE, LISTING_INTERACTION}
const campaignTypeToBillingEventMap = {
    [CampaignTypes.AWARENESS]: 'IMPRESSIONS',
    [CampaignTypes.ACQUISITION]: 'IMPRESSIONS',
    [CampaignTypes.ENGAGEMENT]: 'IMPRESSIONS',
    [CampaignTypes.LOCAL]: 'IMPRESSIONS',
    [CampaignTypes.LEADS]: 'IMPRESSIONS',
    [CampaignTypes.SALES]: 'IMPRESSIONS',
};

const getStatusForIntegrationAd = (campaignStatus?: CampaignStatuses) => {
    if (campaignStatus === CampaignStatuses.PAUSED || !campaignStatus) {
        return 'PAUSED'; // TODO
    }

    if (campaignStatus === CampaignStatuses.REMOVED) {
        return 'PAUSED';
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
) => {
    const params: any = {};

    if (adSet.name) {
        params.name = `[automated] ${adSet.name}`;
    }

    if (adSet.status) {
        params.status = getStatusForIntegrationAd(adSet.status);
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
) => axios({
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
                // instagram_actor_id: context.igPageId,
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

export {
    createAdSet,
    updateAdSet,
    createAd,
};
