import * as socketio from 'socket.io';
import printLogs from 'therr-js-utilities/print-logs';
import {
    Notifications, SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION, UserConnectionTypes,
} from 'therr-js-utilities/constants';
import beeline from '../beeline';
import redisSessions from '../store/redisSessions';
import globalConfig from '../../../../global-config';
import restRequest from '../utilities/restRequest';

interface ICreateUserConnectionData {
    connection: any;
    user: any;
}

interface IUpdateUserConnectionData {
    connection: {
        interactionCount?: number;
        isConnectionBroken?: boolean,
        otherUserId: string,
        requestStatus?: UserConnectionTypes,
    };
    user: any;
}

const createConnection = (socket: socketio.Socket, data: ICreateUserConnectionData, decodedAuthenticationToken: any) => {
    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data.user?.userName} with socketId ${socket.id}, created a userConnection`,
        tracer: beeline,
        traceArgs: {
            socketId: socket.id,
        },
    });
    redisSessions.getUserById(data.connection.acceptingUserId).then((response) => {
        const socketId = response?.socketId;
        if (socketId) {
            const connection = { ...data.connection };
            const notification = data.connection.notification;
            delete connection.notification;
            socket.to(socketId).emit(SOCKET_MIDDLEWARE_ACTION, { // To user who accepted request
                type: SocketServerActionTypes.NOTIFICATION_CREATED,
                data: {
                    ...notification,
                    userConnection: connection,
                },
            });
        }
    });
};

const updateConnection = (socket: socketio.Socket, data: IUpdateUserConnectionData, decodedAuthenticationToken: any) => {
    let requestingSocketId;
    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data.user?.userName} with socketId ${socket.id}, updated a userConnection`,
        tracer: beeline,
        traceArgs: {
            socketId: socket.id,
        },
    });

    return restRequest({
        method: 'put',
        url: `${globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute}/users/connections`,
        data: {
            interactionCount: data.connection.interactionCount,
            isConnectionBroken: data.connection.isConnectionBroken,
            otherUserId: data.connection.otherUserId,
            requestStatus: data.connection.requestStatus,
        },
    }, socket, decodedAuthenticationToken).then(({ data: connection }) => {
        Promise.all([
            redisSessions.getUserById(connection.requestingUserId),
            redisSessions.getUserById(connection.acceptingUserId),
        ]).then(([rUserResponse, aUserResponse]) => {
            const rUserSocketId = rUserResponse?.socketId;
            if (rUserSocketId) {
                if (connection.isConnectionBroken) {
                    // send socket event to remove connection and content from blocked/connection-removed user
                    // TO USER WHO SENT REQUEST...
                    socket.to(rUserSocketId).emit(SOCKET_MIDDLEWARE_ACTION, {
                        type: SocketServerActionTypes.USER_CONNECTION_UPDATED,
                        data: connection,
                    });
                } else if (connection.requestStatus === UserConnectionTypes.COMPLETE) { // Do not send notification when connection denied
                    // TO USER WHO SENT REQUEST...
                    socket.to(rUserSocketId).emit(SOCKET_MIDDLEWARE_ACTION, {
                        type: SocketServerActionTypes.USER_CONNECTION_UPDATED,
                        data: connection,
                    });

                    if (aUserResponse?.user) {
                        const acceptingUser = {
                            ...aUserResponse.user,
                        };
                        delete acceptingUser.idToken; // IMPORTANT - don't sent id token to another user
                        socket.to(rUserSocketId).emit(SOCKET_MIDDLEWARE_ACTION, {
                            type: SocketServerActionTypes.ACTIVE_CONNECTIONS_ADDED,
                            data: acceptingUser,
                        });
                    }

                    // TO USER ACCEPTING REQUEST...
                    socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                        type: SocketServerActionTypes.USER_CONNECTION_UPDATED,
                        data: connection,
                    });

                    if (rUserResponse?.user) {
                        const requestingUser = {
                            ...rUserResponse.user,
                        };
                        delete requestingUser.idToken; // IMPORTANT - don't sent id token to another user
                        socket.emit(SOCKET_MIDDLEWARE_ACTION, {
                            type: SocketServerActionTypes.ACTIVE_CONNECTIONS_ADDED,
                            data: requestingUser,
                        });
                    }
                }
            }
        });

        return connection;
    }).then((connection: any) => {
        if (connection.requestStatus === UserConnectionTypes.COMPLETE) { // Do not send notification when connection denied
            return restRequest({
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV || 'development'].baseUsersServiceRoute}/users/notifications`,
                data: {
                    userId: connection.requestingUserId,
                    type: Notifications.Types.CONNECTION_REQUEST_ACCEPTED,
                    associationId: connection.id,
                    isUnread: true,
                    messageLocaleKey: Notifications.MessageKeys.CONNECTION_REQUEST_ACCEPTED,
                    messageParams: {
                        userId: connection.acceptingUserId,
                        firstName: data.user?.firstName,
                        lastName: data.user?.lastName,
                    },
                },
            }, socket, decodedAuthenticationToken).then(({ data: notification }) => {
                socket.to(requestingSocketId).emit(SOCKET_MIDDLEWARE_ACTION, { // To user who sent request
                    type: SocketServerActionTypes.NOTIFICATION_CREATED,
                    data: notification,
                });

                return notification;
            });
        }

        return Promise.resolve(connection);
    }).catch((err) => {
        printLogs({
            level: 'error',
            messageOrigin: 'SOCKET_IO_LOGS',
            messages: err.toString(),
            tracer: beeline,
            traceArgs: {
                errorMessage: err?.message,
                source: 'userConnections',
            },
        });
    });
};

const loadActiveConnections = (socket: socketio.Socket, data: any, decodedAuthenticationToken: any) => {
    const users = data.connections
        .map((connection) => {
            const contextUserId = connection.users[0].id === data.userId ? connection.users[1].id : connection.users[0].id;

            return connection.users.find((user) => user.id === contextUserId);
        });

    redisSessions.getUsersByIds(users).then((cachedActiveUsers) => {
        const activeUsers: any[] = [];
        users.forEach((u) => {
            const mappedMatch = cachedActiveUsers.find((activeUser) => activeUser.id === u.id);
            if (mappedMatch) {
                activeUsers.push({
                    ...u,
                    ...mappedMatch,
                });
            }
        });

        socket.emit(SOCKET_MIDDLEWARE_ACTION, {
            type: SocketServerActionTypes.ACTIVE_CONNECTIONS_LOADED,
            data: {
                activeUsers,
            },
        });
    });
};

export {
    createConnection,
    updateConnection,
    loadActiveConnections,
};
