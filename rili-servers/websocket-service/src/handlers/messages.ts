import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import moment from 'moment';
import { SocketServerActionTypes, SocketClientActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'rili-public-library/utilities/constants.js';
import beeline from '../beeline';

const sendDirectMessage = (socket: socketio.Socket, data: any) => {
    const now = moment(Date.now()).format('MMMM D/YY, h:mma');
    socket.emit('action', {
        type: SocketServerActionTypes.SEND_DIRECT_MESSAGE,
        data: {
            contextUserId: data.to.id,
            message: {
                key: Date.now().toString(),
                time: now,
                text: `You: ${data.message}`,
            },
        },
    });
    socket.broadcast.to(data.to.socketId).emit(SOCKET_MIDDLEWARE_ACTION, {
        type: SocketServerActionTypes.SEND_DIRECT_MESSAGE,
        data: {
            contextUserId: data.userId,
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
            context: data.to,
        },
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
