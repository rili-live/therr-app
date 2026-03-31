/* eslint-disable class-methods-use-this */
import axios from 'axios';

class ApiKeysService {
    create = (data: { name?: string }) => axios({
        method: 'post',
        url: '/users-service/api-keys',
        data,
    });

    list = () => axios({
        method: 'get',
        url: '/users-service/api-keys',
    });

    revoke = (id: string) => axios({
        method: 'delete',
        url: `/users-service/api-keys/${id}`,
    });
}

export default new ApiKeysService();
