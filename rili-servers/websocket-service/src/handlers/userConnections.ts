import axios from 'axios';
import * as socketio from 'socket.io';
import printLogs from 'rili-public-library/utilities/print-logs.js';
import { SocketServerActionTypes } from 'rili-public-library/utilities/constants.js';
import beeline from '../beeline';
import * as Constants from '../constants';
import redisSessions from '../store/redisSessions';
import globalConfig from '../../../../global-config.js';

interface ICreateUserConnectionData {
    connection: any;
    user: any;
}

interface IUpdateUserConnectionData {
    connection: any;
    userName: string;
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
        socket.to(socketId).emit(Constants.ACTION, { // To user who accepted request
            type: SocketServerActionTypes.NOTIFICATION_CREATED,
            data: {
                ...notification,
                userConnection: connection,
            },
        });
    });
};

const updateConnection = (socket: socketio.Socket, data: IUpdateUserConnectionData) => {
    printLogs({
        level: 'info',
        messageOrigin: 'SOCKET_IO_LOGS',
        messages: `User, ${data.userName} with socketId ${socket.id}, updated a userConnection`,
        tracer: beeline,
        traceArgs: {
            socketId: socket.id,
        },
    });
    axios({
        method: 'put',
        url: `${globalConfig[process.env.NODE_ENV || 'development'].baseApiRoute}/users/connections/${data.connection.requestingUserId}`,
        data: data.connection,
    }).then((response) => {
        redisSessions.getByUserId(data.connection.requestingUserId).then(({
            socketId,
        }) => {
            // TODO: RSERV-26 - Also emit notification
            socket.to(socketId).emit(Constants.ACTION, { // To user who sent request
                type: SocketServerActionTypes.USER_CONNECTION_UPDATED,
                data: response.data,
            });
            socket.emit(Constants.ACTION, { // To user who accepted request
                type: SocketServerActionTypes.USER_CONNECTION_UPDATED,
                data: response.data,
            });
        });
    });
};

export {
    createConnection,
    updateConnection,
};
