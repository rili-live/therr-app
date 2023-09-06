import axios from 'axios';

class CampaignsService {
    create = (data: any) => axios({
        method: 'post',
        url: '/users-service/campaigns',
        data,
    });
}

export default new CampaignsService();
