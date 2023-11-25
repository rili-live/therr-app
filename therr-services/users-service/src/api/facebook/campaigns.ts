import axios from 'axios';
import { CampaignTypes } from 'therr-js-utilities/constants';
import { passthroughAndLogErrors } from './utils';

const campaignTypeToObjectiveMap = {
    [CampaignTypes.AWARENESS]: 'OUTCOME_AWARENESS',
    [CampaignTypes.ACQUISITION]: 'OUTCOME_TRAFFIC',
    [CampaignTypes.ENGAGEMENT]: 'OUTCOME_ENGAGEMENT',
    [CampaignTypes.LOCAL]: 'OUTCOME_AWARENESS',
    [CampaignTypes.LEADS]: 'OUTCOME_LEADS',
    [CampaignTypes.SALES]: 'OUTCOME_SALES',
};

const sanitizeMaxBudget = (budget?: number) => {
    if (budget) {
        return budget * 100;
    }

    return budget;
};

/**
 * Creates an ad campaign
 */
const createCampaign = (adAccountId, accessToken, campaign: {
    title: string;
    type?: string;
    maxBudget?: number;
}) => axios({
    method: 'post',
    // eslint-disable-next-line max-len
    url: `https://graph.facebook.com/v18.0/${adAccountId}/campaigns?access_token=${accessToken}`,
    params: {
        name: `[automated] ${campaign.title}`,
        objective: campaign.type ? campaignTypeToObjectiveMap[campaign.type] : 'OUTCOME_TRAFFIC',
        status: 'PAUSED',
        special_ad_categories: '[]',
        lifetime_budget: sanitizeMaxBudget(campaign.maxBudget) || 922337203685478,
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
}) => {
    const params: any = {
        name: `[automated] ${campaign.title}`,
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
