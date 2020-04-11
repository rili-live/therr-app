import moment from 'moment';
import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import { SocketServerActionTypes } from 'rili-public-library/utilities/constants.js';
import beeline from '../beeline';
import * as Constants from '../constants';
import redisSessions from '../store/redisSessions';

export interface ILoginData {
    idToken: string;
    userName: string;
    id: string;
}

interface ILoginArgs {
    appName: string;
    socket: socketio.Socket;
    data: ILoginData;
}

interface ILogoutArgs {
    socket: socketio.Socket;
    data: ILoginData;
}

const login = ({
    appName,
    socket,
    data,
}: ILoginArgs) => {
    const now = moment(Date.now()).format('MMMM D/YY, h:mma');

    if (socket.handshake && socket.handshake.headers && socket.handshake.headers.host) {
        redisSessions.create({
            app: appName,
            socketId: socket.id,
            ip: socket.handshake.headers.host.split(':')[0],
            // 30 minutes
            ttl: 60 * 1000 * 30,
            data: {
                id: socket.id,
                previousSocketId: null,
                userId: data.id,
                userName: data.userName,
                idToken: data.idToken,
            },
        }).then((response: any) => {
            socket.emit(Constants.ACTION, {
                type: SocketServerActionTypes.SESSION_CREATED,
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
                    userName: data.userName,
                },
            });
        });
    }

    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data.userName} with socketId ${socket.id}, has logged in.`,
        tracer: beeline,
        traceArgs: {
            appName,
            ip: socket.handshake.headers.host.split(':')[0],
            socketId: socket.id,
            userName: data.userName,
        },
    });

    // Emits an event back to the client who logged in
    socket.emit(Constants.ACTION, {
        type: SocketServerActionTypes.USER_LOGIN_SUCCESS,
        data: {
            message: {
                key: Date.now().toString(),
                time: now,
                text: 'You have been logged in successfully.',
            },
            userName: data.userName,
        },
    });
};

const logout = ({
    socket,
    data,
}: ILogoutArgs) => {
    const now = moment(Date.now()).format('MMMM D/YY, h:mma');

    if (socket.handshake && socket.handshake.headers && socket.handshake.headers.host) {
        redisSessions.remove(socket.id).then((response: any) => {
            socket.emit(Constants.ACTION, {
                type: SocketServerActionTypes.SESSION_CLOSED,
                data: {},
            });
        }).catch((err: any) => {
            printLogs({
                level: 'verbose',
                messageOrigin: 'REDIS_SESSION_ERROR',
                messages: err.toString(),
                tracer: beeline,
                traceArgs: {
                    ip: socket.handshake.headers.host.split(':')[0],
                    socketId: socket.id,
                    userName: data.userName,
                },
            });
        });
    }

    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data.userName} with socketId ${socket.id}, has LOGGED OUT.`,
        tracer: beeline,
        traceArgs: {
            ip: socket.handshake.headers.host.split(':')[0],
            socketId: socket.id,
            userName: data.userName,
        },
    });

    // Emits an event back to the client who logged OUT
    socket.emit(Constants.ACTION, {
        type: SocketServerActionTypes.USER_LOGOUT_SUCCESS,
        data: {
            message: {
                key: Date.now().toString(),
                time: now,
                text: 'You have been logged in successfully.',
            },
            userName: data.userName,
        },
    });
};

export {
    login,
    logout,
};
