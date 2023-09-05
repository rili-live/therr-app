import moment from 'moment';
import * as socketio from 'socket.io';
import logSpan from 'therr-js-utilities/log-or-update-span';
import { SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'therr-js-utilities/constants';
import redisSessions from '../store/redisSessions';
import notifyConnections from '../utilities/notify-connections';
import { COMMON_DATE_FORMAT, UserStatus } from '../constants';

export interface ILoginData {
    idToken: string;
    userName: string;
    firstName: string;
    lastName: string;
    status: UserStatus;
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
    // TODO: RFRONT-25 - localize dates
    const now = moment(Date.now()).format(COMMON_DATE_FORMAT);

    if (socket.handshake && (socket.handshake.headers as any) && (socket.handshake.headers as any).host) {
        redisSessions.createOrUpdate({
            app: appName,
            socketId: socket.id,
            ip: (socket.handshake.headers as any).host.split(':')[0],
            // 30 minutes
            ttl: 1 * 60 * 30,
            data: {
                id: data?.id,
                socketId: socket.id,
                previousSocketId: null,
                userName: data?.userName,
                firstName: data?.firstName,
                lastName: data?.lastName,
                idToken: data?.idToken,
                status: UserStatus.ACTIVE,
            },
        }).then((response: any) => {
            notifyConnections(
                socket,
                { ...data, status: UserStatus.ACTIVE },
                SocketServerActionTypes.ACTIVE_CONNECTION_LOGGED_IN,
                true,
                {},
            );

            socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                type: SocketServerActionTypes.SESSION_CREATED,
                data: response,
            });
        }).catch((err: any) => {
            logSpan({
                level: 'error',
                messageOrigin: 'REDIS_SESSION_ERROR',
                messages: err.toString(),
                traceArgs: {
                    appName,
                    ip: (socket?.handshake.headers as any).host.split(':')[0],
                    'socket.id': socket?.id,
                    'user.userName': data?.userName,
                },
            });
        });
    }

    logSpan({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data?.userName} with socketId ${socket.id}, has logged in.`,
        traceArgs: {
            appName,
            ip: (socket.handshake.headers as any).host.split(':')[0],
            'socket.id': socket.id,
            'user.userName': data?.userName,
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
            userName: data?.userName,
        },
    });
};

const logout = ({
    socket,
    data,
}: ILogoutArgs) => {
    // TODO: RFRONT-25 - localize dates
    const now = moment(Date.now()).format(COMMON_DATE_FORMAT);
    const promises: any[] = [];

    if (data && data.id) {
        const promise = notifyConnections(
            socket,
            data,
            SocketServerActionTypes.ACTIVE_CONNECTION_LOGGED_OUT,
            false,
            {},
        );

        promises.push(promise);
    }

    if (socket.handshake && (socket.handshake.headers as any) && (socket.handshake.headers as any).host) {
        Promise.all(promises).then(() => {
            redisSessions.remove(socket.id).catch((err: any) => {
                logSpan({
                    level: 'info',
                    messageOrigin: 'REDIS_SESSION_ERROR',
                    messages: err.toString(),
                    traceArgs: {
                        ip: (socket.handshake.headers as any).host.split(':')[0],
                        'socket.id': socket.id,
                        'user.userId': data && data.id,
                        'user.userName': data && data.userName,
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

    logSpan({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data?.userName || 'unknown'} with socketId ${socket.id}, has LOGGED OUT.`,
        traceArgs: {
            'socket.ip': (socket.handshake.headers as any).host.split(':')[0],
            'socket.id': socket.id,
            'user.userName': data && data.userName,
        },
    });
};

export {
    login,
    logout,
};
