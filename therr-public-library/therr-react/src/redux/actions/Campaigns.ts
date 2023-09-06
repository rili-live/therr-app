import { CampaignsService } from '../../services';
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
};

export default Campaigns;
