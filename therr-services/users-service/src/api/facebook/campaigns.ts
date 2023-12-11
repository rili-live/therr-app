import axios from 'axios';
import { CampaignStatuses, CampaignTypes } from 'therr-js-utilities/constants';
import { passthroughAndLogErrors, sanitizeMaxBudget } from './utils';

// TODO
// const campaignTypeToObjectiveMap = {
// eslint-disable-next-line max-len
//     [CampaignTypes.AWARENESS]: 'OUTCOME_AWARENESS', // valid FB adSet optimization_goal = AD_RECALL_LIFT, REACH, IMPRESSIONS, THRUPLAY, TWO_SECOND_CONTINUOUS_VIDEO_VIEWS
//     [CampaignTypes.ACQUISITION]: 'OUTCOME_TRAFFIC', // valid FB adSet optimization_goal = LINK_CLICKS, LANDING_PAGE_VIEWS, REACH, IMPRESSIONS, QUALITY_CALL,
// eslint-disable-next-line max-len
//     [CampaignTypes.ENGAGEMENT]: 'OUTCOME_ENGAGEMENT', // valid FB adSet optimization_goal = POST_ENGAGEMENT, REACH, IMPRESSIONS, PAGE_LIKES, EVENT_RESPONSES, CONVERSATIONS, LEAD_GENERATION, OFFSITE_CONVERSIONS, LANDING_PAGE_VIEWS
//     [CampaignTypes.LOCAL]: 'OUTCOME_AWARENESS', // SEE ABOVE
//     [CampaignTypes.LEADS]: 'OUTCOME_TRAFFIC', // SEE ABOVE
//     [CampaignTypes.SALES]: 'OUTCOME_TRAFFIC', // SEE ABOVE
// };

// TODO: Use above settings and dynamically create ads that are compatible for each ad set objective
const campaignTypeToObjectiveMap = {
    [CampaignTypes.AWARENESS]: 'OUTCOME_TRAFFIC',
    [CampaignTypes.ACQUISITION]: 'OUTCOME_TRAFFIC',
    [CampaignTypes.ENGAGEMENT]: 'OUTCOME_TRAFFIC',
    [CampaignTypes.LOCAL]: 'OUTCOME_TRAFFIC',
    [CampaignTypes.LEADS]: 'OUTCOME_TRAFFIC',
    [CampaignTypes.SALES]: 'OUTCOME_TRAFFIC',
};

const getStatusForIntegration = (campaignStatus?: CampaignStatuses) => {
    if (campaignStatus === CampaignStatuses.PAUSED || !campaignStatus) {
        return 'PAUSED'; // TODO
    }

    if (campaignStatus === CampaignStatuses.REMOVED) {
        return 'PAUSED';
    }

    return 'PAUSED';
};

/**
 * Creates an ad campaign
 */
const createCampaign = (adAccountId, accessToken, campaign: {
    title: string;
    type?: CampaignTypes;
    maxBudget?: number;
    status?: CampaignStatuses;
}) => axios({
    method: 'post',
    // eslint-disable-next-line max-len
    url: `https://graph.facebook.com/v18.0/${adAccountId}/campaigns?access_token=${accessToken}`,
    params: {
        name: `[automated] ${campaign.title}`,
        objective: campaign.type ? campaignTypeToObjectiveMap[campaign.type] : 'OUTCOME_TRAFFIC',
        status: getStatusForIntegration(campaign.status),
        special_ad_categories: '[]',
        lifetime_budget: sanitizeMaxBudget(campaign.maxBudget),
    },
}).catch((err) => ({
    data: {
        errors: err.response?.data?.error,
    },
})).then(passthroughAndLogErrors);

/**
 * Update an ad campaign
 */
const updateCampaign = (adAccountId, accessToken, campaign: {
    id: string;
    title: string;
    maxBudget?: number;
    status?: CampaignStatuses;
}) => {
    const params: any = {
        name: `[automated] ${campaign.title}`,
        status: getStatusForIntegration(campaign.status),
    };

    if (campaign.maxBudget) {
        params.lifetime_budget = sanitizeMaxBudget(campaign.maxBudget);
    }

    return axios({
        method: 'post',
        // eslint-disable-next-line max-len
        url: `https://graph.facebook.com/v18.0/${campaign.id}?fields=configured_status&access_token=${accessToken}`,
        params,
    }).catch((err) => ({
        data: {
            errors: err.response?.data?.error,
        },
    })).then(passthroughAndLogErrors);
};

/**
 * Update an ad campaign
 */
const deleteCampaign = (adAccountId, accessToken, campaignId: string) => axios({
    method: 'delete',
    // eslint-disable-next-line max-len
    url: `https://graph.facebook.com/v18.0/${campaignId}?access_token=${accessToken}`,
}).catch((err) => ({
    data: {
        errors: err.response?.data?.error,
    },
})).then(passthroughAndLogErrors);

export {
    createCampaign,
    updateCampaign,
    deleteCampaign,
};
