import moment from 'moment';
import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'rili-public-library/utilities/constants.js';
import beeline from '../beeline';

interface IRoomData {
    roomId: string;
    userName: string;
}

const joinRoom = (socket: socketio.Socket, data: IRoomData) => {
    const now = moment(Date.now()).format('MMMM D/YY, h:mma');

    socket.join(data.roomId, () => {
        printLogs({
            level: 'info',
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: `User, ${data.userName} with socketId ${socket.id}, joined room ${data.roomId}`,
            tracer: beeline,
            traceArgs: {
                socketId: socket.id,
            },
        });
        printLogs({
            level: 'info',
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: `${data.userName}'s Current Rooms: ${JSON.stringify(socket.rooms)}`,
            traceArgs: {
                socketId: socket.id,
            },
        });

        // Emits an event back to the client who joined
        socket.emit(SOCKET_MIDDLEWARE_ACTION, {
            type: SocketServerActionTypes.JOINED_ROOM,
            data: {
                roomId: data.roomId,
                message: {
                    key: Date.now().toString(),
                    time: now,
                    text: `You joined the room, ${data.roomId}`,
                },
                userName: data.userName,
            },
        });

        // Broadcasts an event back to the client for all users in the specified room (excluding the user who triggered it)
        socket.broadcast.to(data.roomId).emit(SOCKET_MIDDLEWARE_ACTION, {
            type: SocketServerActionTypes.OTHER_JOINED_ROOM,
            data: {
                roomId: data.roomId,
                message: {
                    key: Date.now().toString(),
                    time: now,
                    text: `${data.userName} joined room, ${data.roomId}`,
                },
            },
        });
    });
};

const leaveRoom = (socket: socketio.Socket, data: IRoomData) => {
    const now = moment(Date.now()).format('MMMM D/YY, h:mma');

    socket.leave(data.roomId);

    // Emits an event back to the client who left
    socket.emit(SOCKET_MIDDLEWARE_ACTION, {
        type: SocketServerActionTypes.LEFT_ROOM,
        data: {
            roomId: data.roomId,
            message: {
                key: Date.now().toString(),
                time: now,
                message: `You left the room, ${data.roomId}`,
            },
        },
    });

    // Broadcasts an event back to the client for all users in the specified room (excluding the user who triggered it)
    socket.broadcast.to(data.roomId).emit(SOCKET_MIDDLEWARE_ACTION, {
        type: SocketServerActionTypes.LEFT_ROOM,
        data: {
            roomId: data.roomId,
            message: {
                key: Date.now().toString(),
                time: now,
                text: `${data.userName} left the room`,
            },
        },
    });

    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data.userName} with socketId ${socket.id}, left room ${data.roomId}`,
        tracer: beeline,
        traceArgs: {
            socketId: socket.id,
        },
    });
};

export {
    joinRoom,
    leaveRoom,
};
