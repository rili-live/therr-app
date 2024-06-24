// import { RequestHandler } from 'express';
import axios from 'axios';
import { parseHeaders } from 'therr-js-utilities/http';
import {
    GroupMemberRoles,
    GroupRequestStatuses,
    Notifications,
    PushNotifications,
} from 'therr-js-utilities/constants';
import logSpan from 'therr-js-utilities/log-or-update-span';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
// import translate from '../utilities/translator';
import * as globalConfig from '../../../../global-config';
import notifyUserOfUpdate from '../utilities/notifyUserOfUpdate';

// READ
const getUserGroups = (req, res) => Store.userGroups.get({
    userId: req.headers['x-userid'],
})
    .then(async (results) => {
        let userGroups = results;
        let groups: any[] = [];
        if (req.query.withGroups) {
            const {
                authorization,
                locale,
                whiteLabelOrigin,
                userId,
            } = parseHeaders(req.headers);

            const groupResponse = await axios({
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}/forums/find`,
                headers: {
                    'x-localecode': locale,
                    'x-userid': userId,
                    'x-therr-origin-host': whiteLabelOrigin,
                },
                data: {
                    ids: userGroups.filter((userGroup) => [
                        GroupMemberRoles.ADMIN,
                        GroupMemberRoles.CREATOR,
                        GroupMemberRoles.EVENT_HOST,
                    ].includes(userGroup.role)).map((userGroup) => userGroup.groupId),
                },
            });

            groups = groupResponse?.data || [];
            const groupsMap = (groups).reduce((acc, cur) => {
                acc[cur.id] = cur;
                return acc;
            }, {});
            userGroups = userGroups.map((userGroup) => ({
                ...userGroup,
                group: groupsMap[userGroup.groupId],
            }));
        }

        return res.status(200).send({
            userGroups,
            groups,
        });
    })
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_GROUPS_ROUTES:ERROR' }));

const getGroupMembers = (req, res) => Store.userGroups.get({
    groupId: req.params.id,
    status: GroupRequestStatuses.APPROVED,
}, {
    limit: req.query.limit,
    returning: req.query.returning,
    shouldIncludePending: true,
})
    .then((results) => Store.users.findUsers({
        ids: results.map((r) => r.userId),
    }).then((users) => {
        const usersById = users.reduce((acc, cur) => ({
            ...acc,
            [cur.id]: cur,
        }), {});

        return res.status(200).send({
            userGroups: results.map((userGroup) => ({
                ...userGroup,
                user: usersById[userGroup.userId] || {},
            })),
        });
    }))
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_GROUPS_ROUTES:ERROR' }));

// WRITE
const internalCreateUserGroups = (req, res) => {
    const {
        authorization,
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const {
        group,
        role,
        memberIds,
        memberRole,
    } = req.body;

    // TODO: Check if group requires approval
    const status = GroupRequestStatuses.APPROVED;

    const newUserGroups = [{
        groupId: group.id,
        userId,
        status,
        shouldMuteNotifs: false,
        role,
    }];

    if (memberIds) {
        memberIds.forEach((memberId) => {
            // Default invited members to pending and member role unless otherwise specified
            newUserGroups.push({
                groupId: group.id,
                userId: memberId,
                status: GroupRequestStatuses.PENDING,
                shouldMuteNotifs: false,
                role: memberRole || GroupMemberRoles.MEMBER,
            });
        });
    }

    return Store.userGroups.create(newUserGroups)
        .then((userGroups) => {
            const userGroup = userGroups.filter((g) => g.userId === userId);
            const invitedMembers = userGroups.filter((g) => g.userId !== userId);
            if (invitedMembers?.length) {
                Store.users.getUserById(userId, ['id', 'userName']).then(([inviter]) => {
                    const promises = invitedMembers.map((member) => notifyUserOfUpdate({
                        authorization,
                        locale,
                        whiteLabelOrigin,
                    }, {
                        userId: member.userId,
                        type: Notifications.Types.NEW_GROUP_INVITE,
                        associationId: group.id,
                        isUnread: true,
                        messageLocaleKey: Notifications.MessageKeys.NEW_GROUP_INVITE,
                        messageParams: {
                            groupName: group.title,
                            inviterId: userId,
                            inviterUserName: inviter?.userName,
                        },
                    }, {
                        toUserId: member.userId,
                        fromUser: {
                            id: userId,
                            name: inviter?.userName,
                        },
                        retentionEmailType: PushNotifications.Types.newGroupInvite,
                        groupName: group.title,
                    }, {
                        shouldCreateDBNotification: true,
                        shouldSendPushNotification: true,
                        shouldSendEmail: true,
                    }));

                    return Promise.all(promises);
                }).catch((err) => logSpan({
                    level: 'error',
                    messageOrigin: 'API_SERVER',
                    messages: ['Failed to send NEW_GROUP_INVITE notifications'],
                    traceArgs: {
                        'error.message': err?.message,
                    },
                }));
            }

            return res.status(201).send(userGroup);
        })
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_GROUPS_ROUTES:ERROR' }));
};

const createUserGroup = (req, res) => {
    const {
        authorization,
        locale,
        whiteLabelOrigin,
        userId,
    } = parseHeaders(req.headers);
    const {
        groupId,
    } = req.body;

    return axios({
        method: 'get',
        url: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}/forums/${groupId}`,
        headers: {
            'x-localecode': locale,
            'x-userid': userId,
            'x-therr-origin-host': whiteLabelOrigin,
        },
    }).then((response) => {
        const group = response.data;
        // TODO: Check if group requires approval
        const status = GroupRequestStatuses.APPROVED;

        return Store.users.findUsers(
            {
                ids: [userId, group.authorId],
            },
            ['id', 'email', 'userName', 'isUnclaimed', 'deviceMobileFirebaseToken'],
        ).then((users) => {
            // NOTE: Users should already be a member of their own group, but no reason to error in that case
            if (users.length !== 2 && userId !== group.authorId) {
                return handleHttpError({
                    res,
                    message: 'User or group author not found',
                    statusCode: 400,
                });
            }
            const fromUserNames = [(users.find((u) => u.id !== group.authorId) || users[0])?.userName];

            return Store.userGroups.create([{
                groupId,
                userId,
                status,
                shouldMuteNotifs: false,
            }])
                .then(([userGroup]) => {
                    // Fetch group author and notify
                    notifyUserOfUpdate({
                        authorization,
                        locale,
                        whiteLabelOrigin,
                    }, {
                        userId: group.authorId,
                        type: Notifications.Types.NEW_GROUP_MEMBERS,
                        associationId: groupId,
                        isUnread: true,
                        messageLocaleKey: Notifications.MessageKeys.NEW_GROUP_MEMBERS,
                        messageParams: {
                            groupName: group.title,
                            members: fromUserNames.join(', '),
                        },
                    }, {
                        toUserId: group.authorId,
                        fromUser: {
                            id: userId,
                        },
                        fromUserNames,
                        retentionEmailType: PushNotifications.Types.newGroupMembers,
                        groupName: group.title,
                    }, {
                        shouldCreateDBNotification: true,
                        shouldSendPushNotification: true,
                        shouldSendEmail: true,
                    }).catch((err) => logSpan({
                        level: 'error',
                        messageOrigin: 'API_SERVER',
                        messages: ['Failed to send NEW_GROUP_MEMBERS notification'],
                        traceArgs: {
                            'error.message': err?.message,
                        },
                    }));

                    return res.status(201).send(userGroup);
                });
        });
    }).catch((err) => handleHttpError({ err, res, message: 'SQL:USER_GROUPS_ROUTES:ERROR' }));
};

const updateUserGroup = (req, res) => {
    const {
        userId,
    } = parseHeaders(req.headers);
    const {
        role,
        status,
    } = req.body;

    return Store.userGroups.update(req.params.id, {
        role,
        status,
    })
        .then((results) => res.status(201).send({
            userGroups: results,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_GROUPS_ROUTES:ERROR' }));
};

const deleteUserGroup = (req, res) => {
    const {
        userId,
    } = parseHeaders(req.headers);
    const {
        role,
        status,
    } = req.body;

    return Store.userGroups.delete(req.params.id, userId)
        .then((results) => res.status(201).send({
            userGroups: results,
        }))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_GROUPS_ROUTES:ERROR' }));
};

const notifyGroupMembers = (req, res) => {
    const {
        locale,
        userId,
        whiteLabelOrigin,
    } = parseHeaders(req.headers);
    const {
        groupId,
        groupName,
        excludedMembers,
        messageType,
    } = req.body;

    const exclusionMap = excludedMembers?.reduce((acc, cur) => {
        acc[cur] = cur;
        return acc;
    }, {}) || {};

    if (!groupId) {
        return handleHttpError({
            res,
            message: 'Group not found',
            statusCode: 404,
        });
    }

    // TODO: Fetch group name
    return axios({
        method: 'get',
        url: `${globalConfig[process.env.NODE_ENV].baseMessagesServiceRoute}/forums/${groupId}`,
        headers: {
            'x-localecode': locale,
            'x-userid': userId,
            'x-therr-origin-host': whiteLabelOrigin,
        },
    }).then((groupResponse) => Store.userGroups.get({
        groupId,
        status: GroupRequestStatuses.APPROVED,
    })
        .then((userGroups) => {
            const filteredUserGroups = userGroups.filter((userGroup) => !exclusionMap[userGroup.userId]);
            const userIds = filteredUserGroups.map((userGroup) => userGroup.userId);
            const userGroupsMap = filteredUserGroups.reduce((acc, cur) => {
                acc[cur.userId] = cur;
                return acc;
            }, {});
            return Store.users.findUsers(
                {
                    ids: userIds,
                },
                ['id', 'email', 'deviceMobileFirebaseToken'],
            ).then((users) => {
                const usersWithGroup = users.map((user) => ({
                    ...user,
                    role: userGroupsMap[user.id].role,
                    shouldMuteNotifs: userGroupsMap[user.id].shouldMuteNotifs,
                    shouldShareLocation: userGroupsMap[user.id].shouldShareLocation,
                }));

                // NOTE: This does NOT create app notifications (only push notifications)
                return axios({
                    method: 'post',
                    url: `${globalConfig[process.env.NODE_ENV].basePushNotificationsServiceRoute}/notifications/send-multiple`,
                    headers: {
                        'x-localecode': locale,
                        'x-userid': userId,
                        'x-therr-origin-host': whiteLabelOrigin,
                    },
                    data: {
                        users: usersWithGroup,
                        type: PushNotifications.Types.newGroupMessage,
                        groupDetails: {
                            id: groupId,
                            name: groupName || groupResponse.data?.title,
                        },
                        fromUserDetails: {
                            id: userId,
                        },
                    },
                });
            });
        })
        .then(() => res.status(200).send({
            successUserIds: {},
            failedUserIds: {},
        }))).catch((err) => handleHttpError({ err, res, message: 'SQL:USER_GROUPS_ROUTES:ERROR' }));
};

export {
    getUserGroups,
    getGroupMembers,
    internalCreateUserGroups,
    createUserGroup,
    updateUserGroup,
    deleteUserGroup,
    notifyGroupMembers,
};
