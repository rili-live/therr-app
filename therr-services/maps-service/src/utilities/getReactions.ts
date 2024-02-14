import axios from 'axios';
import * as globalConfig from '../../../../global-config';

const baseReactionsServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseReactionsServiceRoute;

export default (areaType: 'moment' | 'space' | 'event', areaId: string, headers) => axios({
    method: 'get',
    url: `${baseReactionsServiceRoute}/${areaType}-reactions/${areaId}`,
    headers,
})
    .then(({ data: areaReaction }) => !!(areaReaction && areaReaction.userHasActivated))
    .catch((err) => {
        if (err?.response?.data?.statusCode === 403) {
            return false;
        }
        throw err;
    });
