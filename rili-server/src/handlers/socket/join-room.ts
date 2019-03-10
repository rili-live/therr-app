import * as moment from 'moment';
import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs'; // tslint:disable-line no-implicit-dependencies
import { SocketServerActionTypes } from 'rili-public-library/utilities/constants';
import * as Constants from '../../constants';
import { rsAppName, shouldIncludeRedisLogs, shouldIncludeSocketLogs } from '../../server-socket-io';

const joinRoom = (socket: socketio.Socket, redisSession: any, data: any) => {
    const now = moment(Date.now()).format('MMMM D/YY, h:mma');

    // Leave all current rooms (except default room) before joining a new one
    Object.keys(socket.rooms)
        .filter((room) => room !== socket.id)
        .forEach((room) => {
            socket.broadcast.to(room).emit('event', `${data.userName} left the room`);
            socket.leave(room);
        });

    // TODO: RSERV-4: Determine why this setTimeout exists
    setTimeout(() => {
        socket.join(data.roomId, () => {
            // TODO: After adding user login, this should be created after login rather then after joining a room
            if (socket.handshake && socket.handshake.headers && socket.handshake.headers.host) {
                redisSession.create({
                    app: rsAppName,
                    socketId: socket.id,
                    ip: socket.handshake.headers.host.split(':')[0],
                    // 30 minutes
                    ttl: 60 * 1000 * 30,
                    data: {
                        userName: data.userName,
                    },
                }).then((response: any) => {
                    socket.emit(Constants.ACTION, {
                        type: SocketServerActionTypes.SESSION_MESSAGE,
                        data: response,
                    });
                }).catch((err: any) => {
                    printLogs(shouldIncludeRedisLogs, 'REDIS_SESSION_ERROR', null, err);
                });
            }

            printLogs(shouldIncludeSocketLogs, 'SOCKET_IO_LOGS', null, `User, ${data.userName} with socketId ${socket.id}, joined room ${data.roomId}`);
            printLogs(shouldIncludeSocketLogs, 'SOCKET_IO_LOGS', null, `${data.userName}'s Current Rooms: ${JSON.stringify(socket.rooms)}`);

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
                }
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
    }, 0);
};

export default joinRoom;
