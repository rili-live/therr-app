import * as Immutable from 'seamless-immutable';
import { SocketServerActionTypes, SocketClientActionTypes } from 'therr-js-utilities/constants';
import { ICampaignsState, CampaignActionTypes } from '../../types/redux/campaigns';

const initialState: ICampaignsState = Immutable.from({
    campaigns: Immutable.from({}),
    searchResults: Immutable.from({}),
});

const campaigns = (state: ICampaignsState = initialState, action: any) => {
    // If state is initialized by server-side rendering, it may not be a proper immutable object yet
    if (!state.setIn) {
        state = state ? Immutable.from(state) : initialState; // eslint-disable-line no-param-reassign
    }

    const modifiedCampaigns = { ...state.campaigns };
    const modifiedSearchResults = { ...state.searchResults };

    switch (action.type) {
        case CampaignActionTypes.CREATE_CAMPAIGN:
            action.data?.campaigns?.forEach((campaign) => {
                modifiedCampaigns[campaign.id] = campaign;
            });
            return state.setIn(['campaigns'], modifiedCampaigns);
        case CampaignActionTypes.UPDATE_CAMPAIGN:
            action.data?.campaigns?.forEach((campaign) => {
                modifiedCampaigns[campaign.id] = {
                    ...(modifiedCampaigns[campaign.id] || {}),
                    ...campaign,
                };
            });

            return state.setIn(['campaigns'], modifiedCampaigns);
        case CampaignActionTypes.GET_CAMPAIGN:
            if (action.data?.id) {
                if (!modifiedCampaigns[action.data.id]) {
                    modifiedCampaigns[action.data.id] = action.data;
                } else {
                    modifiedCampaigns[action.data.id] = {
                        ...modifiedCampaigns[action.data.id],
                        ...action.data,
                    };
                }
            }
            return state.setIn(['campaigns'], modifiedCampaigns);
        case CampaignActionTypes.SEARCH_MY_CAMPAIGNS:
            // Convert array to object for faster lookup and de-duping
            return state.setIn(['searchResults'], action.data.results
                .reduce((acc, item) => ({
                    ...acc,
                    [item.id]: item,
                }), modifiedSearchResults));
        case SocketClientActionTypes.LOGOUT:
            return state.setIn(['campaigns'], Immutable.from([]));
        default:
            return state;
    }
};

export default campaigns;
