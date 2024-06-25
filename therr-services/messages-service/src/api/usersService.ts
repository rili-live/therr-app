import axios from 'axios';
import { GroupMemberRoles, GroupRequestStatuses } from 'therr-js-utilities/constants';
import * as globalConfig from '../../../../global-config';

const getUserForums = (headers: any) => axios({
    method: 'get',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-groups`,
    headers,
});

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

const createUserForums = (headers: any, group: any, memberIds: string[]) => axios({
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-groups/privileged`,
    headers,
    data: {
        group: {
            id: group.id,
            authorId: group.authorId,
            title: group.title,
            isPublic: group.isPublic,
            subtitle: group.subtitle,
            description: group.description,
            hashTags: group.hashTags,
        },
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
    getUserForums,
    createUserForum,
    createUserForums,
    findUsers,
};
