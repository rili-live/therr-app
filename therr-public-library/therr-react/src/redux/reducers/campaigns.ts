import { produce } from 'immer';
import { SocketClientActionTypes } from 'therr-js-utilities/constants';
import { ICampaignsState, CampaignActionTypes } from '../../types/redux/campaigns';

const initialState: ICampaignsState = {
    campaigns: {},
    searchResults: {},
};

const campaigns = produce((draft: ICampaignsState, action: any) => {
    switch (action.type) {
        case CampaignActionTypes.CREATE_CAMPAIGN:
            action.data?.campaigns?.forEach((campaign) => {
                draft.campaigns[campaign.id] = campaign;
            });
            break;
        case CampaignActionTypes.UPDATE_CAMPAIGN:
            action.data?.campaigns?.forEach((campaign) => {
                draft.campaigns[campaign.id] = {
                    ...(draft.campaigns[campaign.id] || {}),
                    ...campaign,
                };
            });
            break;
        case CampaignActionTypes.GET_CAMPAIGN:
            if (action.data?.id) {
                if (!draft.campaigns[action.data.id]) {
                    draft.campaigns[action.data.id] = action.data;
                } else {
                    draft.campaigns[action.data.id] = {
                        ...draft.campaigns[action.data.id],
                        ...action.data,
                    };
                }
            }
            break;
        case CampaignActionTypes.SEARCH_MY_CAMPAIGNS:
            action.data.results.forEach((item) => {
                draft.searchResults[item.id] = item;
            });
            break;
        case SocketClientActionTypes.LOGOUT:
            draft.campaigns = [];
            break;
        default:
            break;
    }
}, initialState);

export default campaigns;
