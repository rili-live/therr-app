import * as socketio from 'socket.io';
import logSpan from 'therr-js-utilities/log-or-update-span';
import moment from 'moment';
import {
    Notifications,
    SocketServerActionTypes,
    SocketClientActionTypes,
    SOCKET_MIDDLEWARE_ACTION,
} from 'therr-js-utilities/constants';
import restRequest from '../utilities/restRequest';
import redisHelper from '../utilities/redisHelper';
import globalConfig from '../../../../global-config';
import { FORUM_PREFIX } from './rooms';
import { COMMON_DATE_FORMAT } from '../constants';

const sendDirectMessage = (socket: socketio.Socket, data: any, decodedAuthenticationToken: any) => {
    restRequest({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV || 'development'].baseMessagesServiceRoute}/direct-messages`,
        data: {
            message: data.message,
            toUserId: data.to.id,
            fromUserId: data.userId,
            isUnread: false, // TODO: RSERV-36 - derive from frontend message
        },
    }, socket, decodedAuthenticationToken).then(({ data: message }) => {
        // TODO: RFRONT-25 - localize dates
        const timeFormatted = moment(message.createdAt || Date.now()).format(COMMON_DATE_FORMAT); // TODO: RFRONT-25 - localize dates
        socket.emit('action', {
            type: SocketServerActionTypes.SEND_DIRECT_MESSAGE,
            data: {
                contextUserId: data.to.id,
                message: {
                    id: message.id,
                    fromUserName: 'you',
                    fromUserImgSrc: data.userImgSrc,
                    time: timeFormatted,
                    text: data.message,
                },
            },
        });
        if (data.to.socketId) { // Null when user is not logged in
            socket.broadcast.to(data.to.socketId).emit(SOCKET_MIDDLEWARE_ACTION, {
                type: SocketServerActionTypes.SEND_DIRECT_MESSAGE,
                data: {
                    contextUserId: data.userId,
                    message: {
                        id: message.id,
                        fromUserName: data.userName,
                        fromUserImgSrc: data.userImgSrc,
                        time: timeFormatted,
                        text: data.message,
                    },
                },
            });
        } else {
            // Send new direct message notification
            redisHelper.throttleDmNotifications(data.to.id, data.userId)
                .then((shouldCreateNotification) => {
                    if (shouldCreateNotification) { // fire and forget
                        restRequest({
                            method: 'post',
                            url: `${globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute}/users/notifications`,
                            data: {
                                userId: data.to.id,
                                type: Notifications.Types.NEW_DM_RECEIVED,
                                associationId: null,
                                isUnread: true,
                                messageLocaleKey: Notifications.MessageKeys.NEW_DM_RECEIVED,
                                messageParams: {
                                    userId: data.userId,
                                    userName: data.userName,
                                },
                                shouldSendPushNotification: true,
                                fromUserName: data.userName,
                            },
                        }, socket, decodedAuthenticationToken).catch((err) => {
                            logSpan({
                                level: 'error',
                                messageOrigin: 'SOCKET_IO_LOGS',
                                messages: err.toString(),
                                traceArgs: {
                                    'error.message': err?.message,
                                    source: 'messages.sendUserNotification',
                                },
                            });
                        });
                    }
                }).catch((err) => {
                    logSpan({
                        level: 'error',
                        messageOrigin: 'SOCKET_IO_LOGS',
                        messages: err.toString(),
                        traceArgs: {
                            'error.message': err?.message,
                            source: 'messages.throttleDmNotifications',
                        },
                    });
                });
        }
        // logSpan({
        //     level: 'debug',
        //     messageOrigin: 'SOCKET_IO_LOGS',
        //     messages: `${data.userName} said: ${data.message}`,
        //     traceArgs: {
        //         socketId: socket.id,
        //         userName: data.userName,
        //         messageText: data.message,
        //         context: data.to,
        //     },
        // });
    }).catch((err) => {
        // TODO: RSERV-36 - Emit error message
        logSpan({
            level: 'error',
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: err.toString(),
            traceArgs: {
                'error.message': err?.message,
                source: 'messages.sendDirectMessage',
            },
        });
    });
};

const sendForumMessage = (socket: socketio.Socket, data: any, decodedAuthenticationToken: any) => {
    restRequest({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV || 'development'].baseMessagesServiceRoute}/forums-messages`,
        data: {
            forumId: data.roomId,
            message: data.message,
            fromUserId: data.userId,
            isUnread: false, // TODO: RSERV-36 - derive from frontend message
        },
    }, socket, decodedAuthenticationToken).then(({ data: message }) => {
        const timeFormatted = moment(message?.createdAt || Date.now()).format(COMMON_DATE_FORMAT); // TODO: RFRONT-25 - localize dates
        socket.emit('action', {
            type: SocketServerActionTypes.SEND_MESSAGE,
            data: {
                roomId: data.roomId,
                message: {
                    key: Date.now().toString(),
                    fromUserName: 'you',
                    fromUserImgSrc: data.userImgSrc,
                    time: timeFormatted,
                    text: data.message,
                },
            },
        });
        socket.broadcast.to(`${FORUM_PREFIX}${data.roomId}`).emit(SOCKET_MIDDLEWARE_ACTION, {
            type: SocketServerActionTypes.SEND_MESSAGE,
            data: {
                roomId: data.roomId,
                message: {
                    key: Date.now().toString(),
                    fromUserName: data.userName,
                    fromUserImgSrc: data.userImgSrc,
                    time: timeFormatted,
                    text: data.message,
                },
            },
        });

        // TODO: Send a push notification to each user who is a member of the room (excluding sender)
        // DO NOT create a db notification unless user lacks a sockedId in Redis
        return restRequest({
            method: 'post',
            url: `${globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute}/users-groups/notify-members`,
            data: {
                groupId: data.roomId,
                groupName: data.roomName,
                excludedMembers: [data.userId],
            },
        }, socket, decodedAuthenticationToken).catch((err) => {
            logSpan({
                level: 'error',
                messageOrigin: 'SOCKET_IO_LOGS',
                messages: err.toString(),
                traceArgs: {
                    'error.message': err?.message,
                    source: 'messages.sendForumMessage',
                },
            });
        });
    }).catch((err) => {
        // TODO: RSERV-36 - Emit error message
        logSpan({
            level: 'error',
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: err.toString(),
            traceArgs: {
                'error.message': err?.message,
                source: 'messages.sendForumMessage',
            },
        });
    });
};

export {
    sendDirectMessage,
    sendForumMessage,
};
