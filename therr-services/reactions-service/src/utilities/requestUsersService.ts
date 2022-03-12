import axios, { Method } from 'axios';
import * as globalConfig from '../../../../global-config';

interface IRequestUsersServiceConfig {
    authorization: string;
    locale: string;
    userId: string;
}

interface IRequestUsersServiceArgs {
    path: string;
    method: Method;
}

export default ({
    authorization,
    locale,
    userId,
}: IRequestUsersServiceConfig, {
    path,
    method,
}: IRequestUsersServiceArgs, requestBody = {}) => axios({
    method,
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}${path}`,
    headers: {
        authorization,
        'x-localecode': locale,
        'x-userid': userId,
    },
    data: requestBody,
});
