/* eslint-disable class-methods-use-this */
import axios from 'axios';

export interface IApiKey {
    id: string;
    name?: string;
    keyPrefix: string;
    accessLevels: string[];
    lastAccessed?: string;
    createdAt: string;
    /**
     * Only ever populated on the create response. The raw key is hashed server-side and is
     * unrecoverable afterwards, so the UI has one chance to show it.
     */
    key?: string;
}

class ApiKeysService {
    list = () => axios({
        method: 'get',
        url: '/users-service/api-keys',
    });

    create = (data: { name?: string; accessLevels?: string[] }) => axios({
        method: 'post',
        url: '/users-service/api-keys',
        data,
    });

    revoke = (id: string) => axios({
        method: 'delete',
        url: `/users-service/api-keys/${id}`,
    });
}

export default new ApiKeysService();
