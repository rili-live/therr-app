import moment from 'moment';
import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'rili-public-library/utilities/constants.js';
import beeline from '../beeline';
import redisSessions from '../store/redisSessions';
import notifyConnections from '../utilities/notify-connections';

export interface ILoginData {
    idToken: string;
    userName: string;
    firstName: string;
    lastName: string;
    id: string;
}

interface ILoginArgs {
    appName: string;
    socket: socketio.Socket;
    data: ILoginData;
}

interface ILogoutArgs {
    socket: socketio.Socket;
    data?: ILoginData;
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
                id: data.id,
                socketId: socket.id,
                previousSocketId: null,
                userName: data.userName,
                firstName: data.firstName,
                lastName: data.lastName,
                idToken: data.idToken,
            },
        }).then((response: any) => {
            notifyConnections(socket, data, SocketServerActionTypes.ACTIVE_CONNECTION_LOGGED_IN, true);

            socket.emit(SOCKET_MIDDLEWARE_ACTION, {
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

    // TODO: RFRONT-33 - Notify activeConnections of login presence

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
    socket.emit(SOCKET_MIDDLEWARE_ACTION, {
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
    const promises: any[] = [];

    if (data && data.id) {
        const promise = notifyConnections(socket, data, SocketServerActionTypes.ACTIVE_CONNECTION_LOGGED_OUT);

        promises.push(promise);
    }

    if (socket.handshake && socket.handshake.headers && socket.handshake.headers.host) {
        Promise.all(promises).then(() => {
            redisSessions.remove(socket.id).catch((err: any) => {
                printLogs({
                    level: 'info',
                    messageOrigin: 'REDIS_SESSION_ERROR',
                    messages: err.toString(),
                    tracer: beeline,
                    traceArgs: {
                        ip: socket.handshake.headers.host.split(':')[0],
                        socketId: socket.id,
                        userId: data && data.id,
                        userName: data && data.userName,
                    },
                });
            }).finally(() => {
                socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                    type: SocketServerActionTypes.SESSION_CLOSED,
                    data: {},
                });
            });
        });
    }

    // Emits an event back to the client who logged OUT
    socket.emit(SOCKET_MIDDLEWARE_ACTION, {
        type: SocketServerActionTypes.USER_LOGOUT_SUCCESS,
        data: {
            message: {
                key: Date.now().toString(),
                time: now,
                text: 'You have been logged out successfully.',
            },
            userName: data && data.userName,
        },
    });

    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data ? data.userName : 'unknown'} with socketId ${socket.id}, has LOGGED OUT.`,
        tracer: beeline,
        traceArgs: {
            ip: socket.handshake.headers.host.split(':')[0],
            socketId: socket.id,
            userName: data && data.userName,
        },
    });
};

export {
    login,
    logout,
};
