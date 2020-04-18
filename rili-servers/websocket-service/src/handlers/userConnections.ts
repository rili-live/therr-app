import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import { Notifications, SocketServerActionTypes, SOCKET_MIDDLEWARE_ACTION } from 'rili-public-library/utilities/constants.js';
import beeline from '../beeline';
import redisSessions from '../store/redisSessions';
import globalConfig from '../../../../global-config.js';
import restRequest from '../utilities/restRequest';

interface ICreateUserConnectionData {
    connection: any;
    user: any;
}

interface IUpdateUserConnectionData {
    connection: any;
    user: any;
}

const createConnection = (socket: socketio.Socket, data: ICreateUserConnectionData) => {
    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data.user.userName} with socketId ${socket.id}, created a userConnection`,
        tracer: beeline,
        traceArgs: {
            socketId: socket.id,
        },
    });
    redisSessions.getByUserId(data.connection.acceptingUserId).then(({ socketId }) => {
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
    });
};

const updateConnection = (socket: socketio.Socket, data: IUpdateUserConnectionData) => {
    let requestingSocketId;
    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data.user.userName} with socketId ${socket.id}, updated a userConnection`,
        tracer: beeline,
        traceArgs: {
            socketId: socket.id,
        },
    });

    return restRequest({
        method: 'put',
        url: `${globalConfig[process.env.NODE_ENV || 'development'].baseApiRoute}/users/connections/${data.connection.requestingUserId}`,
        data: data.connection,
    }, socket).then(({ data: connection }) => {
        redisSessions.getByUserId(data.connection.requestingUserId).then(({
            socketId,
        }) => {
            requestingSocketId = socketId;

            if (connection.requestStatus === 'complete') { // Do not send notification when connection denied
                socket.to(requestingSocketId).emit(SOCKET_MIDDLEWARE_ACTION, { // To user who sent request
                    type: SocketServerActionTypes.USER_CONNECTION_UPDATED,
                    data: connection,
                });

                socket.emit(SOCKET_MIDDLEWARE_ACTION, { // To user who accepted request
                    type: SocketServerActionTypes.USER_CONNECTION_UPDATED,
                    data: connection,
                });
            }
        });

        return connection;
    }).then((connection: any) => {
        if (connection.requestStatus === 'complete') { // Do not send notification when connection denied
            return restRequest({
                method: 'post',
                url: `${globalConfig[process.env.NODE_ENV || 'development'].baseApiRoute}/users/notifications`,
                data: {
                    userId: data.connection.requestingUserId,
                    type: Notifications.Types.CONNECTION_REQUEST_ACCEPTED,
                    associationId: connection.id,
                    isUnread: true,
                    messageLocaleKey: Notifications.MessageKeys.CONNECTION_REQUEST_ACCEPTED,
                    messageParams: {
                        firstName: data.user.firstName,
                        lastName: data.user.lastName,
                    },
                },
            }, socket).then(({ data: notification }) => {
                socket.to(requestingSocketId).emit(SOCKET_MIDDLEWARE_ACTION, { // To user who sent request
                    type: SocketServerActionTypes.NOTIFICATION_CREATED,
                    data: notification,
                });

                return notification;
            });
        }

        return Promise.resolve(connection);
    });
};

export {
    createConnection,
    updateConnection,
};
