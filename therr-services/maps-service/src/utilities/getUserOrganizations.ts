import axios from 'axios';
import * as globalConfig from '../../../../global-config';

const baseUsersServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute;

export default (headers) => axios({
    method: 'get',
    url: `${baseUsersServiceRoute}/users/organizations`,
    headers,
})
    .then(({ data: orgsResponse }) => orgsResponse);
