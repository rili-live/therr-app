import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import * as globalConfig from '../../../../global-config';

const baseUsersServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute;

export default (groupId: string, headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'get',
    url: `${baseUsersServiceRoute}/users-groups`,
})
    .then(({ data: result }) => !!(result?.userGroups?.find((group) => group.id === groupId)))
    .catch((err) => {
        if (err?.response?.data?.statusCode === 403) {
            return false;
        }
        throw err;
    });
