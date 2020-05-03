import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import moment from 'moment';
import { SocketServerActionTypes, SocketClientActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'rili-public-library/utilities/constants.js';
import beeline from '../beeline';
import restRequest from '../utilities/restRequest';
import globalConfig from '../../../../global-config.js';

const sendDirectMessage = (socket: socketio.Socket, data: any) => {
    restRequest({
        method: 'post',
        url: `${globalConfig[process.env.NODE_ENV || 'development'].baseMessagesServiceRoute}/direct-messages`,
        data: {
            message: data.message,
            toUserId: data.to.id,
            fromUserId: data.userId,
            isUnread: false, // TODO: RSERV-36 - derive from frontend message
        },
    }, socket).then(({ data: message }) => {
        const timeFormatted = moment(message.updatedAt).format('MMMM D/YY, h:mma');
        socket.emit('action', {
            type: SocketServerActionTypes.SEND_DIRECT_MESSAGE,
            data: {
                contextUserId: data.to.id,
                message: {
                    key: message.id,
                    time: timeFormatted,
                    text: `You: ${data.message}`,
                },
            },
        });
        socket.broadcast.to(data.to.socketId).emit(SOCKET_MIDDLEWARE_ACTION, {
            type: SocketServerActionTypes.SEND_DIRECT_MESSAGE,
            data: {
                contextUserId: data.userId,
                message: {
                    key: message.id,
                    time: timeFormatted,
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
                messageText: `You: ${data.message}`,
                context: data.to,
            },
        });
    }).catch((err) => {
        // TODO: RSERV-36 - Emit error message
        console.log(err);
    });
};

const sendMessage = (socket: socketio.Socket, data: any) => {
    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `${SocketClientActionTypes.SEND_MESSAGE}: ${data.toString()}`,
    });
    const now = moment(Date.now()).format('MMMM D/YY, h:mma');
    socket.emit('action', {
        type: SocketServerActionTypes.SEND_MESSAGE,
        data: {
            roomId: data.roomId,
            message: {
                key: Date.now().toString(),
                time: now,
                text: `You: ${data.message}`,
            },
        },
    });
    socket.broadcast.to(data.roomId).emit(SOCKET_MIDDLEWARE_ACTION, {
        type: SocketServerActionTypes.SEND_MESSAGE,
        data: {
            roomId: data.roomId,
            message: {
                key: Date.now().toString(),
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
            messageText: `You: ${data.message}`,
        },
    });
};

export {
    sendDirectMessage,
    sendMessage,
};
