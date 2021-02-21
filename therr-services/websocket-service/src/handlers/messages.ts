import * as socketio from 'socket.io';
import printLogs from 'therr-js-utilities/print-logs';
import moment from 'moment';
import {
    Notifications,
    SocketServerActionTypes,
    SocketClientActionTypes,
    SOCKET_MIDDLEWARE_ACTION,
} from 'therr-js-utilities/constants';
import beeline from '../beeline';
import restRequest from '../utilities/restRequest';
import redisHelper from '../utilities/redisHelper';
import globalConfig from '../../../../global-config';
import { FORUM_PREFIX } from './rooms';
import { COMMON_DATE_FORMAT } from '../constants';

const sendDirectMessage = (socket: socketio.Socket, data: any) => {
    restRequest({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV || 'development'].baseApiGatewayRoute}/messages-service/direct-messages`,
        data: {
            message: data.message,
            toUserId: data.to.id,
            fromUserId: data.userId,
            isUnread: false, // TODO: RSERV-36 - derive from frontend message
        },
    }, socket).then(({ data: message }) => {
        // TODO: RFRONT-25 - localize dates
        const timeFormatted = moment(message.updatedAt).format(COMMON_DATE_FORMAT); // TODO: RFRONT-25 - localize dates
        socket.emit('action', {
            type: SocketServerActionTypes.SEND_DIRECT_MESSAGE,
            data: {
                contextUserId: data.to.id,
                message: {
                    key: message.id,
                    fromUserName: 'you',
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
                        key: message.id,
                        fromUserName: data.userName,
                        time: timeFormatted,
                        text: data.message,
                    },
                },
            });
        } else {
            // Send new direct message notification
            redisHelper.throttleDmNotifications(data.to.id, data.userId)
                .then((shouldCreateNotification) => {
                    if (shouldCreateNotification) {
                        restRequest({
                            method: 'post',
                            url: `${globalConfig[process.env.NODE_ENV || 'development'].baseApiGatewayRoute}/users-service/users/notifications`,
                            data: {
                                userId: data.to.id,
                                type: Notifications.Types.NEW_DM_RECEIVED,
                                associationId: null,
                                isUnread: true,
                                messageLocaleKey: Notifications.MessageKeys.NEW_DM_RECEIVED,
                                messageParams: {
                                    userName: data.userName,
                                },
                            },
                        }, socket);
                    }
                });
        }
        printLogs({
            level: 'info',
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: `${data.userName} said: ${data.message}`,
            tracer: beeline,
            traceArgs: {
                socketId: socket.id,
                userName: data.userName,
                messageText: data.message,
                context: data.to,
            },
        });
    }).catch((err) => {
        // TODO: RSERV-36 - Emit error message
        console.log(err);
    });
};

const sendForumMessage = (socket: socketio.Socket, data: any) => {
    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `${SocketClientActionTypes.SEND_MESSAGE}: ${data.toString()}`,
    });
    // TODO: RFRONT-25 - localize dates
    const now = moment(Date.now()).format(COMMON_DATE_FORMAT);
    socket.emit('action', {
        type: SocketServerActionTypes.SEND_MESSAGE,
        data: {
            roomId: data.roomId,
            message: {
                key: Date.now().toString(),
                fromUserName: 'you',
                time: now,
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
                time: now,
                text: `${data.userName}: ${data.message}`,
            },
        },
    });
    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `${data.userName} said: ${data.message}`,
        tracer: beeline,
        traceArgs: {
            socketId: socket.id,
            userName: data.userName,
            messageText: data.message,
        },
    });
};

export {
    sendDirectMessage,
    sendForumMessage,
};
