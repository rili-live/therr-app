import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'rili-public-library/utilities/constants.js';
import beeline from '../beeline';
import redisSessions from '../store/redisSessions';

export interface ILoginData {
    idToken: string;
    userName: string;
    id: string;
}

interface IUpdateSessionnArgs {
    appName: string;
    socket: socketio.Socket;
    data: {
        details: ILoginData;
        socketDetails: any;
        isAuthenticated: boolean;
    };
}

const update = ({
    appName,
    socket,
    data,
}: IUpdateSessionnArgs) => {
    const user = data.details;
    const socketDetails = data.socketDetails;

    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${user.userName} with socketId ${socket.id}, has refreshed the page. Updating socket.`,
        tracer: beeline,
        traceArgs: {
            ip: socket.handshake.headers.host.split(':')[0],
            socketId: socket.id,
            userName: user.userName,
            previousSocketId: socketDetails.session.id,
        },
    });

    if (socket.handshake && socket.handshake.headers && socket.handshake.headers.host && data.isAuthenticated) {
        redisSessions.update({
            app: appName,
            socketId: socket.id,
            ip: socket.handshake.headers.host.split(':')[0],
            // 30 minutes
            ttl: 60 * 1000 * 30,
            data: {
                id: socket.id,
                previousSocketId: socketDetails.session.id || null,
                userId: user.id,
                userName: user.userName,
                idToken: user.idToken,
            },
        }).then((response: any) => {
            socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                type: SocketServerActionTypes.SESSION_UPDATED,
                data: response,
            });
        }).catch((err: any) => {
            printLogs({
                level: 'verbose',
                messageOrigin: 'REDIS_SESSION_ERROR',
                messages: err.toString(),
                tracer: beeline,
                traceArgs: {
                    appName,
                    ip: socket.handshake.headers.host.split(':')[0],
                    socketId: socket.id,
                    userName: user.userName,
                },
            });
        });
    }
};

export default update;
