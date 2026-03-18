import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import * as globalConfig from '../../../../global-config';

const baseMessagesServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseMessagesServiceRoute;

export default (groupId: string, headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'get',
    url: `${baseMessagesServiceRoute}/forums/${groupId}`,
})
    .then(({ data: result }) => result)
    .catch(() => null);
