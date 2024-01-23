import axios from 'axios';
import * as globalConfig from '../../../../global-config';

const baseUsersServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute;

export default (groupId: string, headers) => axios({
    method: 'get',
    url: `${baseUsersServiceRoute}/users-groups`,
    headers,
})
    .then(({ data: result }) => !!(result?.userGroups?.find((group) => group.id === groupId)))
    .catch((err) => {
        if (err?.response?.data?.statusCode === 403) {
            return false;
        }
        throw err;
    });
