import axios from 'axios';
import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import * as globalConfig from '../../../../global-config';

const baseUsersServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute;

interface IFindUsersArgs {
    ids: string[];
}

export default (args: IFindUsersArgs, headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'post',
    url: `${baseUsersServiceRoute}/users/find`,
    data: args,
}).then(({ data: users }) => users).catch((err) => {
    console.log(err);
    return [];
});
