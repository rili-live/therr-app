import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import * as globalConfig from '../../../../global-config';

const baseUsersServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute;

export default (headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'get',
    url: `${baseUsersServiceRoute}/users/organizations`,
})
    .then(({ data: orgsResponse }) => orgsResponse);
