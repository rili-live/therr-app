import { Method } from 'axios';
import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import * as globalConfig from '../../../../global-config';

interface IRequestUsersServiceArgs {
    path: string;
    method: Method;
}

export default (headers: InternalConfigHeaders, {
    path,
    method,
}: IRequestUsersServiceArgs, requestBody = {}) => internalRestRequest({
    headers,
}, {
    method,
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}${path}`,
    data: requestBody,
});
