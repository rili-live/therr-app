import moment from 'moment';
import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import { SocketServerActionTypes } from 'rili-public-library/utilities/constants.js';
import * as Constants from '../../constants';
import { shouldPrintSocketLogs } from '../../server-socket-io';

interface IJoinRoomData {
    roomId: string;
    userName: string;
}

const joinRoom = (socket: socketio.Socket, redisSession: any, data: IJoinRoomData) => {
    const now = moment(Date.now()).format('MMMM D/YY, h:mma');

    // Leave all current rooms (except default room) before joining a new one
    Object.keys(socket.rooms)
        .filter((room) => room !== socket.id)
        .forEach((room) => {
            socket.broadcast.to(room).emit('event', `${data.userName} left the room`);
            socket.leave(room);
        });

    socket.join(data.roomId, () => {
        printLogs({
            shouldPrintLogs: shouldPrintSocketLogs,
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: `User, ${data.userName} with socketId ${socket.id}, joined room ${data.roomId}`,
        });
        printLogs({
            shouldPrintLogs: shouldPrintSocketLogs,
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: `${data.userName}'s Current Rooms: ${JSON.stringify(socket.rooms)}`,
        });

        // Emits an event back to the client who joined
        socket.emit(Constants.ACTION, {
            type: SocketServerActionTypes.JOINED_ROOM,
            data: {
                roomId: data.roomId,
                message: {
                    key: Date.now().toString(),
                    time: now,
                    text: `You joined room ${data.roomId}`,
                },
                userName: data.userName,
            },
        });
        // Broadcasts an event back to the client for all users in the specified room (excluding the user who triggered it)
        socket.broadcast.to(data.roomId).emit(Constants.ACTION, {
            type: SocketServerActionTypes.OTHER_JOINED_ROOM,
            data: {
                roomId: data.roomId,
                message: {
                    key: Date.now().toString(),
                    time: now,
                    text: `${data.userName} joined room ${data.roomId}`,
                },
            },
        });
    });
};

export default joinRoom;
