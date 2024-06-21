import axios from 'axios';
import { GroupMemberRoles, GroupRequestStatuses } from 'therr-js-utilities/constants';
import * as globalConfig from '../../../../global-config';

const createUserForum = (headers: any, groupId: string) => axios({
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-groups/privileged`,
    headers,
    data: {
        groupId,
        role: GroupMemberRoles.ADMIN,
        status: GroupRequestStatuses.APPROVED,
    },
});

const createUserForums = (headers: any, groupId: string, memberIds: string[]) => axios({
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-groups/privileged`,
    headers,
    data: {
        groupId,
        role: GroupMemberRoles.ADMIN,
        status: GroupRequestStatuses.APPROVED,
        memberIds,
    },
});

const findUsers = (headers: any, userIds: string[]) => axios({
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/find`,
    headers,
    data: {
        ids: userIds,
    },
});

export {
    createUserForum,
    createUserForums,
    findUsers,
};
