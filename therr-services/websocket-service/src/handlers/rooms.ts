import moment from 'moment';
import * as socketio from 'socket.io';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'therr-js-utilities/constants';
import { COMMON_DATE_FORMAT } from '../constants';

export const FORUM_PREFIX = 'FORUM:';

interface IRoomData {
    roomId: string;
    roomName: string;
    userName: string;
    userImgSrc: string;
}

const joinRoom = (socket: socketio.Socket, data: IRoomData, decodedAuthenticationToken: any) => {
    const now = moment(Date.now()).format(COMMON_DATE_FORMAT); // TODO: RFRONT-25 - localize dates
    const roomId = `${FORUM_PREFIX}${data.roomId}`;

    socket.join(roomId);

    logSpan({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data.userName} with socketId ${socket.id}, joined room ${data.roomName}`,
        traceArgs: {
            'socket.id': socket.id,
        },
    });
    logSpan({
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
                fromUserName: 'you',
                fromUserImgSrc: data.userImgSrc,
                time: now,
                text: `You joined the room, ${data.roomName}`,
                isAnnouncement: true,
            },
            userName: data.userName,
        },
    });

    // Broadcasts an event back to the client for all users in the specified room (excluding the user who triggered it)
    socket.broadcast.to(`${FORUM_PREFIX}${data.roomId}`).emit(SOCKET_MIDDLEWARE_ACTION, {
        type: SocketServerActionTypes.OTHER_JOINED_ROOM,
        data: {
            roomId: data.roomId,
            message: {
                key: Date.now().toString(),
                fromUserName: data.userName,
                fromUserImgSrc: data.userImgSrc,
                time: now,
                text: `${data.userName} joined the room, ${data.roomName}`,
                isAnnouncement: true,
            },
        },
    });
};

const leaveRoom = (socket: socketio.Socket, data: IRoomData, decodedAuthenticationToken: any) => {
    const now = moment(Date.now()).format(COMMON_DATE_FORMAT); // TODO: RFRONT-25 - localize dates

    socket.leave(`${FORUM_PREFIX}${data.roomId}`);

    // Emits an event back to the client who left
    socket.emit(SOCKET_MIDDLEWARE_ACTION, {
        type: SocketServerActionTypes.LEFT_ROOM,
        data: {
            roomId: data.roomId,
            message: {
                key: Date.now().toString(),
                fromUserName: 'you',
                fromUserImgSrc: data.userImgSrc,
                time: now,
                text: `You left the room, ${data.roomId}`,
                isAnnouncement: true,
            },
        },
    });

    // Broadcasts an event back to the client for all users in the specified room (excluding the user who triggered it)
    socket.broadcast.to(`${FORUM_PREFIX}${data.roomId}`).emit(SOCKET_MIDDLEWARE_ACTION, {
        type: SocketServerActionTypes.LEFT_ROOM,
        data: {
            roomId: data.roomId,
            message: {
                key: Date.now().toString(),
                fromUserName: data.userName,
                fromUserImgSrc: data.userImgSrc,
                time: now,
                text: `${data.userName} left the room`,
                isAnnouncement: true,
            },
        },
    });

    logSpan({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data.userName} with socketId ${socket.id}, left room ${data.roomId}`,
        traceArgs: {
            'socket.id': socket.id,
        },
    });
};

export {
    joinRoom,
    leaveRoom,
};
