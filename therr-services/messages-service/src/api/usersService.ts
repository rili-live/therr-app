import axios from 'axios';
import * as globalConfig from '../../../../global-config';

const findUsers = (headers: any, userIds: string[]) => axios({
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/find`,
    headers,
    data: {
        ids: userIds,
    },
});

export {
    findUsers,
};
