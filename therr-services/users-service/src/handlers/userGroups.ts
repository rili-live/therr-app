// import { RequestHandler } from 'express';
import axios from 'axios';
import { parseHeaders } from 'therr-js-utilities/http';
import { GroupRequestStatuses, PushNotifications } from 'therr-js-utilities/constants';
import Store from '../store';
import handleHttpError from '../utilities/handleHttpError';
// import translate from '../utilities/translator';
import * as globalConfig from '../../../../global-config';

// READ
const getUserGroups = (req, res) => Store.userGroups.get({
    userId: req.headers['x-userid'],
})
    .then((results) => res.status(200).send({
        userGroups: results,
    }))
    .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));

// WRITE
const createUserGroup = (req, res) => {
    const {
        userId,
    } = parseHeaders(req.headers);
    const {
        groupId,
    } = req.body;

    // TODO: Check if group requires approval
    const status = GroupRequestStatuses.APPROVED;

    return Store.userGroups.create({
        groupId,
        userId,
        status,
    })
        .then(([userGroup]) => res.status(201).send(userGroup))
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));
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
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));
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
        .catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));
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

    // TODO: Fetch group name
    axios({
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
        }))).catch((err) => handleHttpError({ err, res, message: 'SQL:USER_ACHIEVEMENTS_ROUTES:ERROR' }));
};

export {
    getUserGroups,
    createUserGroup,
    updateUserGroup,
    deleteUserGroup,
    notifyGroupMembers,
};
