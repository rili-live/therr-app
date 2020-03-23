import axios from 'axios';

interface ICreateConnectionBody {
    requestingUserId: number;
    acceptingUserEmail?: string;
    acceptingUserPhoneNumber?: string;
}

class UserConnectionsService {
    create = (data: ICreateConnectionBody) => axios({
        method: 'post',
        url: '/users/connections',
        data,
    })
}

export default new UserConnectionsService();
