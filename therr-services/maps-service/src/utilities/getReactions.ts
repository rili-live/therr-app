import axios from 'axios';
import * as globalConfig from '../../../../global-config';

const baseUsersServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseReactionsServiceRoute;

export default (areaType: 'moment' | 'space', areaId: string, headers) => axios({
    method: 'get',
    url: `${baseUsersServiceRoute}/${areaType}-reactions/${areaId}`,
    headers,
})
    .then(({ data: areaReaction }) => !!(areaReaction && areaReaction.userHasActivated))
    .catch((err) => {
        if (err?.response?.data?.statusCode === 403) {
            return false;
        }
        throw err;
    });
