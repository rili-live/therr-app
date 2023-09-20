import { CampaignsService } from '../../services';
import { ISearchQuery } from '../../types';
import { CampaignActionTypes } from '../../types/redux/campaigns';

const Campaigns = {
    // Moments
    create: (campaignDetails: any) => (dispatch: any) => CampaignsService.create(campaignDetails).then((response: any) => {
        dispatch({
            type: CampaignActionTypes.CREATE_CAMPAIGN,
            data: campaignDetails,
        });

        return response?.data;
    }),
    get: (id: string) => (dispatch: any) => CampaignsService.get(id).then((response: any) => {
        dispatch({
            type: CampaignActionTypes.GET_CAMPAIGN,
            data: response.data,
        });

        return response?.data;
    }),
    searchMyCampaigns: (query: ISearchQuery, data: any = {}) => (dispatch: any) => CampaignsService.searchMyCampaigns(query, data)
        .then((response: any) => {
            dispatch({
                type: CampaignActionTypes.SEARCH_MY_CAMPAIGNS,
                data: response?.data,
            });

            return response?.data;
        }),
};

export default Campaigns;
