import axios from 'axios';
import * as globalConfig from '../../../../global-config';

const baseUsersServiceRoute = globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute;

interface IFindUsersArgs {
    ids: string[];
}

export default (args: IFindUsersArgs) => axios({
    method: 'post',
    url: `${baseUsersServiceRoute}/users/find`,
    data: args,
}).then(({ data: users }) => users).catch((err) => {
    console.log(err);
    return [];
});
