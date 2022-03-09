import axios from 'axios';
import * as globalConfig from '../../../../global-config';

interface IRequestUsersServiceArgs {
    authorization: string;
    locale: string;
    userId: string;
    requestBody: any;
}

export default ({
    authorization,
    locale,
    userId,
    requestBody,
}: IRequestUsersServiceArgs) => axios({
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseUsesServiceRoute}/users/send`,
    headers: {
        authorization,
        'x-localecode': locale,
        'x-userid': userId,
    },
    data: requestBody,
});
