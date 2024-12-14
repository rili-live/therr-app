import { internalRestRequest, InternalConfigHeaders } from 'therr-js-utilities/internal-rest-request';
import { GroupMemberRoles, GroupRequestStatuses } from 'therr-js-utilities/constants';
import * as globalConfig from '../../../../global-config';

const getUserForums = (headers: InternalConfigHeaders) => internalRestRequest({
    headers,
}, {
    method: 'get',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-groups`,
});

const createUserForum = (headers: InternalConfigHeaders, groupId: string) => internalRestRequest({
    headers,
}, {
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-groups/privileged`,
    data: {
        group: {
            id: groupId,
        },
        role: GroupMemberRoles.ADMIN,
        status: GroupRequestStatuses.APPROVED,
    },
});

const countForumMembers = (headers: InternalConfigHeaders, groupIds: string[]) => internalRestRequest({
    headers,
}, {
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-groups/count-members`,
    data: {
        groupIds,
    },
});

const createUserForums = (headers: InternalConfigHeaders, group: any, memberIds: string[]) => internalRestRequest({
    headers,
}, {
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users-groups/privileged`,
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

const findUsers = (headers: InternalConfigHeaders, userIds: string[]) => internalRestRequest({
    headers,
}, {
    method: 'post',
    url: `${globalConfig[process.env.NODE_ENV].baseUsersServiceRoute}/users/find`,
    data: {
        ids: userIds,
    },
});

export {
    getUserForums,
    createUserForum,
    countForumMembers,
    createUserForums,
    findUsers,
};
